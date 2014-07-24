"use strict";

;(function(exporting, undefined) {
	
	var options = {};
	
	
	/*
	* Constructor
	*/
	function TexCite() {
		this.db = new TexCiteDB() ;		
	}
	exporting.TexCite = TexCite; //export constructor
	
	/*********** PUBLIC API **************/
	
	TexCite.fn = TexCite.prototype = {
		/*
		Parses the provided content
		@param {string} content: the content to parse (it should be a string with the bibtex content)
		@returns {object} a bibtex model... 
		*/
		parse : function(content) {
			var tokens = _lexify(content);
			//console.log(tokens);
			try{
					var res = _bibtex( { db:this.db, 'tokens': tokens, 'in': {}, 'out': {} });
					return tokens.length==0 ? 'SUCCESS' : 'FAIL see logs';
			}
			catch(ex){
				console.log(ex);
			}
		}
	}
	
	/************ PRIVATE API ************/
	
	
	
	/** LEXER STUFF **/
	
	var regex = {
		WS 		: /^[ \r\n\t]+/,
		RW_COMM	: /^comment/i,
		RW_STR	: /^string/i,
		RW_PRE	: /^preamble/i,
		NAME	: /^[^=@$&!?,;\s\"#%'(){}]+/i,
		LBRACE	: /^\{/,
		RBRACE	: /^\}/,
		COMMA	: /^,/,
		EQUAL	: /^=/,
		AT		: /^@/,
		STRING	: /^"[^"]*"/,
		COMMENT	: /^%[^\n]*\n/,
		GARBAGE : /^./
	};
	
	
	function Token(type,value,start,end, line, pos){
		this.type = type;
		this.value = value;
		this.start = start;
		this.end = end;
		this.line = line;
		this.pos = pos;
	}
	
	/*
	transforms the content string into a list of tokens
	@param {string} content to parse (and transform into list of tokens)
	@returns {Array<Token>} 
	*/
	function _lexify(content){
		var tokens = new Array();
		var global_idx = 0;
		var _content = content;
		var line = 0;
		var new_line_pos=0;
		var re;
		while(_content != ''){
			var m = new Array;
			for(re in regex){
				m = _content.match(regex[re]);
				if(m != null && m[0] != '') {
					//build token
					var tkn = new Token(re,m[0],global_idx, m[0].length + global_idx, line, global_idx - new_line_pos);
					//update the _content variable;
					_content = _content.substr(m[0].length);
					global_idx += m[0].length; 
					
					//update lines
					var nl_match = m[0].match(/\n/g);
					var trailing_spaces;
					if(nl_match != null){
						//get the number of spaces after the new line character
						trailing_spaces = (m[0].replace(/^[^\n\r]/g, '')).match(/[ \t]+$/g);
						line += nl_match.length;
						new_line_pos = global_idx - (trailing_spaces!=null ? trailing_spaces[0].length : 0);
					}
					
					//insert token in the array
					if(re!='WS' && re != 'COMMENT') {
						tokens.push(tkn);
					}
					break;
				}
			}
		}
		
		return tokens;
	}
	
	
	/** PARSER STUFF **/
	
	function RecognitionException(tkn,valid) {
	   this.message = 'Error (' + tkn.line+ ':' + tkn.pos + ') >> expecting ' + 
	   					valid.join(' or ') + ' but found ' + tkn.type + ' (' + tkn.value + ')';
	}
	
	function AttributeUndefinedException(call, attribute) {
		this.message = 'Error (DEV) >> expecting attribute ' + attribute + ' in ' + call; 
	}
	
	/*
	@param {Array<Token>} tokens: the list of tokens to parse
	@param {object} model: the bibtex model to construct
	@returns {object} bibtex model
	*/
	function _bibtex(input) {
		
		var r = input;
		if(r.tokens.length != 0) {
			r = _entry(r);
			r = _bibtex(r);
		}
		return r;
	}
	
	function _entry(input) {
		var r = input;
		r.in = {};
		r.out = {};
		if(_isMatch(r.tokens[0], ['AT'])){
			
			r.tokens.shift();
			if(_isMatch(r.tokens[0], ['RW_COMM'])){
				r.tokens.shift();
				r = _comment(r);
			}
			else {
				if(_isMatch(r.tokens[0], ['RW_STR'])) {
					r.tokens.shift();
					r = _string(r);
				}
				else {
					if(_isMatch(r.tokens[0], ['RW_PRE'])){
						r.tokens.shift();
						r = _preamble(r);
					}
					else {
						r = _record(r);
					}
				}
			}
		}
		else {
			throw new RecognitionException(r.tokens[0],['AT']);
		}
		return r;
	}
	
	function _comment(input) {
		var r = input;
		var tkn = r.tokens.shift();
		while(r.tokens[0].line == tkn.line){
			r.tokens.shift();
		}
		return input;
	}
	
	
	function _string(input) {
		var r = input;
		if(_isMatch(r.tokens[0],['LBRACE'])){
			r.tokens.shift();
			r.in = {caller:'string', id:'_'}; //set the caller attribute
			r = _fields(r);
			if(_isMatch(r.tokens[0], ['RBRACE'])){
				r.tokens.shift();
			}
			else {
				throw new RecognitionException(r.tokens[0],['RBRACE']);
			}
		}
		else {
			throw new RecognitionException(r.tokens[0],['LBRACE']);
		}
		return r;
	}
	
	function _preamble(input) {
		var r = input;
		if(_isMatch(r.tokens[0],['LBRACE'])){
			r.tokens.shift();
			var open_braces = 1;
			while(open_braces > 0) { //balancing BRACES
				open_braces += _isMatch(r.tokens[0], ['LBRACE']) ? 1 : (_isMatch(r.tokens[0], ['RBRACE'])? -1 : 0 ) ;
				var tkn = r.tokens.shift();
			}
		}
		else {
			throw new RecognitionException(r.tokens[0],['LBRACE']);
		}
		return r;
	}
	
	
	function _record(input) {
		var r = input;
		if(_isMatch(r.tokens[0], ['NAME'])){
			r.tokens.shift();
			if(_isMatch(r.tokens[0], ['LBRACE'])){
				r.tokens.shift();
				if(_isMatch(r.tokens[0], ['NAME'])){ 
					var tkn = r.tokens.shift();
					if(_isMatch(r.tokens[0], ['COMMA'])) {
						r.tokens.shift();
						//alert('@record');
						r.in = {caller : 'record', id : tkn.value}; //set the caller and key attributes
						var item = new CiteItem(tkn.value);
						r.db.add([item]);
						r = _fields(r);
						if(_isMatch(r.tokens[0], ['RBRACE'])){
							r.tokens.shift();
						}
						else {
							throw new RecognitionException(r.tokens[0],['RBRACE']);
						}
					}
					else {
						throw new RecognitionException(r.tokens[0],['COMMA']);
					}
				}
				else {
					throw new RecognitionException(r.tokens[0],['NAME']);
				}
			}
			else {
				throw new RecognitionException(r.tokens[0],['LBRACE']);
			}
		}
		else {
			throw new RecognitionException(r.tokens[0],['NAME']);
		}
		return r;
	}
	
	/*
	// IN: caller, id
	*/
	function _fields(input){
		_assertAttributes(input.in, ['caller', 'id'], '_fields');
		var r = input;
		//alert('@fields');
		if(_isMatch(r.tokens[0],['NAME'])){
			r = _field(r);
			if(r.in.caller == 'record'){
				var field_name = r.out.field.k.toLowerCase();
				var citeitem = r.db.get([r.in.id])[0];
				citeitem.setNormalized(field_name, r.out.field.v);
			}
			else {
				if(r.in.caller == 'string') {
					r.db.define([r.out.field]);
				}
			}
			r = _fields(r);
		}
		
		return r;
	}
	
	/*
	// IN: caller
	// OUT: field
	*/
	function _field(input) {
		_assertAttributes(input.in, ['caller'], '_field');
		var r = input;
		var tkn, key;
		if(_isMatch(r.tokens[0],['NAME'])){
			tkn = r.tokens.shift();
			if(_isMatch(r.tokens[0],['EQUAL'])){
				r.tokens.shift();
				//alert('@field');
				r.in['key'] = tkn.value;
				r = _value(r);
				
				if(_isMatch(r.tokens[0], ['COMMA', 'RBRACE'])) {
					if(_isMatch(r.tokens[0], ['COMMA'])){
							r.tokens.shift();
					}
				}
				else {
					throw new RecognitionException(r.tokens[0],['COMMA','RBRACE']);
				}
			}
			else {
				throw new RecognitionException(r.tokens[0],['EQUAL']);
			}
		}
		else {
			throw new RecognitionException(r.tokens[0],['NAME']);
		}
		_assertAttributes(r.out, ['field'], '_field');
		return r;
	}
	
	
	/*
	// IN: caller
	// OUT: field
	*/
	function _value(input) {
		_assertAttributes(input.in, ['key'], '_value');
		var r = input;
		var all_text = '';
		var key = r.in.key;
		//alert('@value');
		if(_isMatch(r.tokens[0], ['LBRACE'])){
			r.tokens.shift();
			var open_braces = 1;
			while(open_braces > 0) {
				open_braces += _isMatch(r.tokens[0], ['LBRACE']) ? 1 : (_isMatch(r.tokens[0], ['RBRACE'])? -1 : 0 ) ;
				var tkn = r.tokens.shift();
				//catch the text inside braces...
				all_text += tkn.type=='GARBAGE' ? tkn.value : ' '+tkn.value; 
			}
			all_text = all_text.substring(0,all_text.length-1);
		}
		else {
			if(_isMatch(r.tokens[0], ['STRING'])) {
				var tkn = r.tokens.shift();
				all_text = tkn.value.substring( 1 , tkn.value.length - 1 );
			}
			else {
				if(_isMatch(r.tokens[0], ['NAME'])) {
					var tkn = r.tokens.shift();
					all_text = tkn.value;
				}
				else {
					throw new RecognitionException(r.tokens[0],['LBRACE', 'STRING', 'NAME']);
				}
			}
		}
		var kv = {k:'',v:''};
		kv.k = key;
		kv.v = all_text;
		r.out['field'] = kv ;
		_assertAttributes(r.out, ['field'], '_value');
		return r;
	}
	
	
	function _isMatch(tkn, followset) {
		return followset.indexOf(tkn.type) != -1 ;
	}
	
	
	function _assertAttributes(io, attributes, call){	
		var l = attributes.length;
		var i = 0;
		for( ; i < l ; i++ ) {
			if(!io.hasOwnProperty(attributes[i]) || ( 
							io.hasOwnProperty(attributes[i]) &&  (
										io[attributes[i]] == '' || 
										io[attributes[i]] == null
								)  
					) 
			){
				throw new AttributeUndefinedException(call,attributes[i]);
			}
		}
	}
	
	
	
	
	
	
	
	
	
	
	
	
	/****** BIBLIOGRALHY DB ********/
	
	function TexCiteDB(){
		var _strings = {};
		var _entries = {};
		
		this.df = function() {
			return _strings;
		}
		this.db = function(){
			return _entries;
		}
	
		return this;
	}
	
	//exporting.TexCiteDB = TexCiteDB; //export constructor
	
	/********** PROTECTED API *************/
	TexCiteDB.fn = TexCiteDB.prototype = {
		
		define : function(strings) {
			var i=0, l=strings.length;
			for(;i<l;i++){
				var str = strings[i] ;
				var key = str.k.trim();
				if(!this.df().hasOwnProperty(key)){
					this.df()[key] = str.v.trim();
				}
				else {
					console.log('REPEATED STRING: ' + key);
				}
			}
			
			return this;
		},
		
		undefine : function(string_keys) {
			var i=0, l=string_keys.length;
			for(;i<l;i++){
				var str_k = string_keys[i] ;
				if(this.df().hasOwnProperty(str_k)){
					delete this.df()[str_k] ;
				}
			}
			return this;
		},
		
		add: function(items) {
			var i=0, l=items.length, key;
			for(; i<l ; i++){
				var citeitem = items[i] ;
				if(citeitem.hasOwnProperty('id')){
					key = citeitem.id;
				} 
				else {
					console.log('NO KEY ON THE ENTRY TO ADD'); //the text shall not be hardcoded here...
				}
				if(! this.db().hasOwnProperty(key)){
					this.db()[key] = citeitem; 
				}
				else {
					console.log('REPEATED KEY: ' + key);
				}
			}

			return this;
		}, 
		
		remove : function(item_keys){
			
			var i=0, l=item_keys.length;
			for(;i<l;i++){
				var item_k = item_keys[i] ;
				if(this.db().hasOwnProperty(item_k)){
					delete this.db[item_k] ;
				}
			}			
			return this;
		},
		
		get : function(item_keys){
			var items = [];
			var i = 0;
			var l = item_keys.length;
			var _db = this.db();	
			for(; i<l ; i++) {
				var ith_key = item_keys[i];
				if(_db.hasOwnProperty(ith_key)){
					items.push(_db[ith_key]);
				}
			}
			return items;
		},
		
		getIf : function(){
			//return this;
		}
	}
	
	
	

})(typeof exports === 'undefined' ?  window : exports); //pass the window as the global context...






;(function(exporting, undefined){
	
	var months = {
		jan : 'January',
		feb : 'February',
		mar : 'March',
		apr : 'April',
		may : 'May',
		jun : 'June',
		jul : 'July',
		aug : 'August',
		sep : 'September',
		oct : 'October',
		nov : 'November',
		dec : 'December'
	}
	
	
	function CiteItem(item_key) {
		this.entry = '';		//The type of the entry
		this.id = item_key;		//The key of the entry
		this.author = [];		//The name(s) of the author(s) (in the case of more than one author, separated by and)
		this.title = '';		//The title of the work
		this.abstract = ''; 	//The abstract of the publication
		this.address = ''; 		//Publisher's address (usually just the city, but can be the full address for lesser-known publishers)
		this.annote = ''; 		//An annotation for annotated bibliography styles (not typical)
		this.booktitle = '';	//The title of the book, if only part of it is being cited	
		this.chapter = '';		//The chapter number
		this.crossref = '';		//The key of the cross-referenced entry
		this.edition = '';		//The edition of a book, long form (such as 'First' or 'Second')
		this.editor = []; 		//The name(s) of the editor(s)
		this.eprint = ''; 		//A specification of an electronic publication, often a preprint or a technical report
		this.howpublished = '';	//How it was published, if the publishing method is nonstandard
		this.institution = ''; 	//The institution that was involved in the publishing, but not necessarily the publisher
		this.journal = ''; 		//The journal or magazine the work was published in
		this.key = '';			//A hidden field used for specifying or overriding the alphabetical order of entries.
		this.month = '';		//The month of publication (or, if unpublished, the month of creation)
		this.note = '';	 		//Miscellaneous extra information
		this.number = ''; 		//The "(issue) number" of a journal, magazine, or tech-report, if applicable.
		this.organization = ''	//The conference sponsor
		this.pages = {start:'', 
					end:''};	//Page numbers, separated either by commas or double-hyphens.
		this.publisher = '';	//The publisher's name
		this.school = ''; 		//The school where the thesis was written
		this.series = ''; 		//The series of books the book was published in
		this.type = ''; 		//The field overriding the default type of publication
		this.url = '';		 	//The WWW address
		this.volume = ''; 		//The volume of a journal or multi-volume book
		this.year = '';			//The year of publication (or, if unpublished, the year of creation)
		
		//other not in wikipedia but several times used
		this.day = ''			//The day of publication...
		this.doi = '';			//Digital object identifier - an identifier with 2 parts Suffix/Prefix (Prefix is either the ISSN or ISBN)
		this.isbn = '';			//International standard book number - a 10 or 13 digits number separated into 4 or 5 groups by - or space
		this.issn = '';			//International standard serial number - is the identifier for publications in series
		this.keywords = [];		//Set of keywords
		this._other = {};
		
		return this;
	}
	
	exporting.CiteItem = CiteItem; //export constructor
	
	
	/******* PUBLIC API **********/
	
	CiteItem.fn = CiteItem.prototype = {
		/*
		Get a field's value matching the given key
		@param {string} key: the key name of the field to retrive the value
		@returns {object} a string witht the value 
		*/
		other : function(key) {
			var _key = key.toLowerCase();
			return (this._other.hasOwnProperty(_key)) ? this._other[_key] : '' ; 
		},
		
		/*
		Inserts hte given value in the given key, but normalized w.r.t the
		sort of key. For instance, if the key=author, then the value is
		processed to be represented in an array (instead of a string) of
		authors. Moreover, each author name is verified according to the
		use of comma to separate first name from other names...
		Other keys follow other normalisations.
		*/
		setNormalized : function (key, value){
			key = key.toLowerCase();
			value = value.trim();
			switch(key) {
				case 'title' : {
					//split the title string by {...} but keeping the match in the array of splits
					var re = /(\{[^}]*\})/;
					var splits = value.split(re);
					//the initial split goes unchanged;
					value = splits[0];
					var i=1;
					for(;i<splits.length ; i++){
						if(splits[i][0]=='{'){
							//remove the curly brackets and trim the resulting string.
							//the text inside curly brackets remains unchanged
							value += splits[i].replace(/[{}]/g,'').trim();
						}
						else {
							//any other part of the tile is lowered
							value += splits[i].toLowerCase();
						}
					}
				}; break ;
			
				case 'editor' : ;
				case 'author' : {
					//separate into an array of authors.
					var all = value.split(/\s+and\s+/);
					var i = 0;
					for(; i<all.length; i++){
						if(all[i].match(/,/)) {
							all[i] = all[i].replace(/(.+)\s*,\s*(.+)/,'$2 $1').replace(/\s+/g,' ');
						}
						all[i] = all[i].trim();
					}
					value = all;
				}; break ;
			
				case 'pages' : {
					//assuming heuristically that pages are always numbers and the first one is the initial one...
					//when only one is given, it is assumed that it is the start page of the publication
					//set the format of the page object
					var pages = {start:'',end:''};
					var found = value.match(/(\d+)/g);
					pages.start = found!==null && found[0]!==null ? found[0] : '';
					pages.end = found!==null && found[1]!==null ? found[1] : '';
					value = pages;
				} ; break ;
			
				case 'month' : {
					value = months.hasOwnProperty(value) ? months[value] : value ;
				} ; break ;
				
				case 'keywords' : {
					//assuming keyword are separated by commas...
					value = value.split(/\s*,\s*/);
				} ; break ;
				
				default : break ;
			}
			if(this.hasOwnProperty(key)) {
				this[key] = value;
			}
			else {
				this._other[key] = value;
			}
		}
		
		//formattings...
		
	}
	
})(typeof exports === 'undefined' ? window : exports);


var T = new TexCite();
console.log(T.db);


console.log(T.parse(
'@comment this is a comment\n' +
'@string {LNCS = {Lecture Notes in Computer Science}}\n' +
'@string {SCP = "Science of Computer Programming"}\n' +
'@preamble{this is a preamble with "{" and "}" braces inside }\n\n' +

'@incollection{oliveira2013,\n\n' +
' title   = {Reconfiguration {Mechanisms} for {Reo} Service Coordination}, \n' +
' author  = {Oliveira, N. and Barbosa, L. S.}, \n' +
'    booktitle 	= {Web Services and Formal Methods},\n'  +
'    publisher 	= {Springer},\n' +
'    series   = {LNCS},\n'+
'	volume   = {7843},\n' +
'    year   = {2013},\n' +
'	 keywords = {music, self-adaptation, ubiquitous\_computing},\n' +
'    pages   = {134--149},\n' + 
'}\n\n\n ' +

'@book{tijms2003,\n' +
'    author = {Tijms, H. C.}, \n'+
'    day = {18}, \n'+
'    edition = {2nd}, \n'+
'    howpublished = {Harcover}, \n'+
'    isbn = {0471498807}, \n'+
'    month = apr, \n'+
'    publisher = {Wiley}, \n'+
'    title = {{A First Course in Stochastic Models}}, \n'+
'    year = {2003} \n'+
'} \n \n \n ' +

'@article{hallsteinsen2012,\n' +
    'abstract = {Today software is the main enabler of many of the appliances and devices omnipresent in our daily life and important for our well being and work satisfaction. It is expected that the software works as intended, and that the software always and everywhere provides us with the best possible utility. This paper discusses the motivation, technical approach, and innovative results of the {MUSIC} project. {MUSIC} provides a comprehensive software development framework for applications that operate in ubiquitous and dynamic computing environments and adapt to context changes. Context is understood as any information about the user needs and operating environment which vary dynamically and have an impact on design choices. {MUSIC} supports several adaptation mechanisms and offers a model-driven application development approach supported by a sophisticated middleware that facilitates the dynamic and automatic adaptation of applications and services based on a clear separation of business logic, context awareness and adaptation concerns. The main contribution of this paper is a holistic, coherent presentation of the motivation, design, implementation, and evaluation of the {MUSIC} development framework and methodology.},\n' +
    'author = {Hallsteinsen, S. and Geihs, K. and Paspallis, N. and Eliassen, F. and Horn, G. and Lorenzo, J. and Mamelli, A. and Papadopoulos, G. A.},\n' +
    'citeulike-article-id = {11052861},\n' +
    'citeulike-linkout-0 = {http://dx.doi.org/10.1016/j.jss.2012.07.052},\n' +
    'doi = {10.1016/j.jss.2012.07.052},\n' +
    'issn = {01641212},\n' +
    'journal = {Journal of Systems and Software},\n' +
    'keywords = {music, self-adaptation, ubiquitous\_computing},\n' +
    'month = dec,\n' +
    'number = {12},\n' +
    'pages = {2840--2859},\n' +
    'posted-at = {2014-07-02 12:27:21},\n' +
    'priority = {2},\n' +
    'title = {A development framework and methodology for self-adapting applications in ubiquitous computing environments},\n' +
    'url = {http://dx.doi.org/10.1016/j.jss.2012.07.052},\n' +
    'volume = {85},\n' +
    'year = {2012}\n' +
'}'

));

