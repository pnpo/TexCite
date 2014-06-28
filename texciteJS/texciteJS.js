//SEE RetinaJS for guidance...

;(function(exporting, undefined) {
	
	var options = {};
	
	
	/*
	* Constructor
	*/
	function TexCite() {}
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
					var res = _bibtex( { "tokens": tokens, "out":{} });
			}
			catch(ex){
				console.log(ex);
			}
			finally{
				return tokens.length==0 ? "SUCCESS" : "FAIL see logs";
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
		SEMI	: /^,/,
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
		while(_content != ""){
			var m = new Array;
			for(re in regex){
				//console.log("trying " + re);
				m = _content.match(regex[re]);
				//console.log(m);
				if(m != null && m[0] != "") {
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
						//console.log(trailing_spaces!=null ? trailing_spaces[0].length : 0);
						new_line_pos = global_idx - (trailing_spaces!=null ? trailing_spaces[0].length : 0);
					}
					
					//console.log(tkn);
					//insert token in the array
					if(re!="WS" && re != "COMMENT") {
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
	   this.message = "Error (" + tkn.line+ ":" + tkn.pos + ") >> expecting " + 
	   					valid.join(" or ") + " but found " + tkn.type + " (" + tkn.value + ")";
	   this.name = "RecognitionException";
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
		if(_isMatch(r.tokens[0], ["AT"])){
			
			r.tokens.shift();
			if(_isMatch(r.tokens[0], ["RW_COMM"])){
				r.tokens.shift();
				r = _comment(r);
			}
			else {
				if(_isMatch(r.tokens[0], ["RW_STR"])) {
					r.tokens.shift();
					r = _string(r);
				}
				else {
					if(_isMatch(r.tokens[0], ["RW_PRE"])){
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
			throw new RecognitionException(r.tokens[0],["AT"]);
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
		if(_isMatch(r.tokens[0],["LBRACE"])){
			r.tokens.shift();
			r = _fields(r);
			if(_isMatch(r.tokens[0], ["RBRACE"])){
				r.tokens.shift();
			}
			else {
				throw new RecognitionException(r.tokens[0],["RBRACE"]);
			}
		}
		else {
			throw new RecognitionException(r.tokens[0],["LBRACE"]);
		}
		return r;
	}
	
	function _preamble(input) {
		var r = input;
		if(_isMatch(r.tokens[0],["LBRACE"])){
			r.tokens.shift();
			var open_braces = 1;
			while(open_braces > 0) { //balancing BRACES
				open_braces += _isMatch(r.tokens[0], ["LBRACE"]) ? 1 : (_isMatch(r.tokens[0], ["RBRACE"])? -1 : 0 ) ;
				var tkn = r.tokens.shift();
			}
		}
		else {
			throw new RecognitionException(r.tokens[0],["LBRACE"]);
		}
		return r;
	}
	
	
	function _record(input) {
		var r = input;
		if(_isMatch(r.tokens[0], ["NAME"])){
			r.tokens.shift();
			if(_isMatch(r.tokens[0], ["LBRACE"])){
				r.tokens.shift();
				if(_isMatch(r.tokens[0], ["NAME"])){
					r.tokens.shift();
					if(_isMatch(r.tokens[0], ["SEMI"])) {
						r.tokens.shift();
						//alert("@record");
						r = _fields(r);
						if(_isMatch(r.tokens[0], ["RBRACE"])){
							r.tokens.shift();
						}
						else {
							throw new RecognitionException(r.tokens[0],["RBRACE"]);
						}
					}
					else {
						throw new RecognitionException(r.tokens[0],["SEMI"]);
					}
				}
				else {
					throw new RecognitionException(r.tokens[0],["NAME"]);
				}
			}
			else {
				throw new RecognitionException(r.tokens[0],["LBRACE"]);
			}
		}
		else {
			throw new RecognitionException(r.tokens[0],["NAME"]);
		}
		return r;
	}
	
	function _fields(input){
		var r = input;
		//alert("@fields");
		if(_isMatch(r.tokens[0],["NAME"])){
			r = _field(r);
			r = _fields(r);
		}
		
		return r;
	}
	
	function _field(input) {
		var r = input;
		if(_isMatch(r.tokens[0],["NAME"])){
			r.tokens.shift();
			if(_isMatch(r.tokens[0],["EQUAL"])){
				r.tokens.shift();
				//alert("@field");
				r = _value(r);
				if(_isMatch(r.tokens[0], ["SEMI", "RBRACE"])) {
					if(_isMatch(r.tokens[0], ["SEMI"])){
							r.tokens.shift();
					}
				}
				else {
					throw new RecognitionException(r.tokens[0],["SEMI","RBRACE"]);
				}
			}
			else {
				throw new RecognitionException(r.tokens[0],["EQUAL"]);
			}
		}
		else {
			throw new RecognitionException(r.tokens[0],["NAME"]);
		}
		return r;
	}
	
	function _value(input) {
		var r = input;
		//alert("@value");
		if(_isMatch(r.tokens[0], ["LBRACE"])){
			r.tokens.shift();
			var open_braces = 1;
			while(open_braces > 0) {
				open_braces += _isMatch(r.tokens[0], ["LBRACE"]) ? 1 : (_isMatch(r.tokens[0], ["RBRACE"])? -1 : 0 ) ;
				var tkn = r.tokens.shift();
				//catch the text inside braces...
				//all_text += tkn.type=="GARBAGE" ? tkn.value : " "+tkn.value; 
			}
		}
		else {
			if(_isMatch(r.tokens[0], ["STRING"])) {
				var tkn = r.tokens.shift();
			}
			else {
				if(_isMatch(r.tokens[0], ["NAME"])) {
					var tkn = r.tokens.shift();
				}
				else {
					throw new RecognitionException(r.tokens[0],["LBRACE", "STRING", "NAME"]);
				}
			}
		}
		return r;
	}
	
	
	function _isMatch(tkn, followset) {
		return followset.indexOf(tkn.type) != -1 ;
	}
	

})(window); //pass the window as the global context...






;(function(exporting, undefined){
	
	function BibtexDB() {
		this.entry = "";			//The type of the entry
		this.id = "";			//The key of the 
		this.author = [];		//The name(s) of the author(s) (in the case of more than one author, separated by and)
		this.title = "";			//The title of the work
		this.address = ""; 		//Publisher's address (usually just the city, but can be the full address for lesser-known publishers)
		this.annote = ""; 		//An annotation for annotated bibliography styles (not typical)
		this.booktitle = "";		//The title of the book, if only part of it is being cited	
		this.chapter = "";		//The chapter number
		this.crossref = "";		//The key of the cross-referenced entry
		this.edition = "";		//The edition of a book, long form (such as "First" or "Second")
		this.editor = []; 		//The name(s) of the editor(s)
		this.eprint = ""; 		//A specification of an electronic publication, often a preprint or a technical report
		this.howpublished = "";	//How it was published, if the publishing method is nonstandard
		this.institution = ""; 	//The institution that was involved in the publishing, but not necessarily the publisher
		this.journal = ""; 		//The journal or magazine the work was published in
		this.key = "";			//A hidden field used for specifying or overriding the alphabetical order of entries.
		this.month = "";		 	//The month of publication (or, if unpublished, the month of creation)
		this.note = "";	 		//Miscellaneous extra information
		this.number = ""; 		//The "(issue) number" of a journal, magazine, or tech-report, if applicable.
		this.organization = ""	//The conference sponsor
		this.pages = "";	 		//Page numbers, separated either by commas or double-hyphens.
		this.publisher = "";		//The publisher's name
		this.school = ""; 		//The school where the thesis was written
		this.series = ""; 		//The series of books the book was published in
		this.type = ""; 			//The field overriding the default type of publication
		this.url = "";		 	//The WWW address
		this.volume = ""; 		//The volume of a journal or multi-volume book
		this.year = "";			//The year of publication (or, if unpublished, the year of creation)
		
		//other not in wikipedia but several times used
		this.isbn = "";			//International standard book number - a 10 or 13 digits number separated into 4 or 5 groups by - or space
		this.issn = "";			//International standard serial number - is the identifier for publications in series
		this.doi = "";			//Digital object identifier - an identifier with 2 parts Suffix/Prefix (Prefix is either the ISSN or ISBN)
		this.keywords = [];		//Set of keywords
		this._other = {};
	}
	
	exporting.BibtexDB = BibtexDB; //export constructor
	
	
	/******* PUBLIC API **********/
	
	BibtexDB.fn = BibtexDB.prototype = {
		/*
		Get a field's value matching the given key
		@param {string} key: the key name of the field to retrive the value
		@returns {object} a string witht the value 
		*/
		other : function(key) {
			var _key = key.toLowerCase();
			return (this._other.hasOwnProperty(_key)) ? this._other[_key] : "" ; 
		}
	}
	
})(window);




/*
var B = new BibtexDB();
//B._other = {com:"ola", sem:"alo"};
B._other["com"	] = "ola";
console.log(B.other("com"));
console.log(B);

var C = new BibtexDB();
console.log(C);
*/



var T = new TexCite();
console.log(T.parse(
"@comment this is a comment\n" +
"@string {LNCS = {Lecture Notes in Computer Science}}\n" +
"@preamble{this is a preamble with '{' and '}' braces inside }\n\n" +

"@incollection{oliveira2013,\n\n" +
" title   = {Reconfiguration Mechanisms for Service Coordination}, \n" +
" author  = {Oliveira, N. and Barbosa, L. S.}, \n" +
"    booktitle 	= {Web Services and Formal Methods},\n"  +
"    publisher 	= {Springer},\n" +
"    series   = {LNCS},\n"+
"	volume   = {7843},\n" +
"    year   = {2013},\n" +
"    pages   = {134--149}\n" +
"}\n\n\n " +

"@book{tijms2003,\n" +
"    author = {Tijms, H. C.}, \n"+
"    day = {18}, \n"+
"    edition = {2nd}, \n"+
"    howpublished = {Harcover}, \n"+
"    isbn = {0471498807}, \n"+
"    month = apr, \n"+
"    publisher = {Wiley}, \n"+
"    title = {A First Course in Stochastic Models}, \n"+
"    year = {2003} \n"+
"}"
));




/*(function(w,x){
    var z;
    function a(v) {
        return v*v;
    }
    
    function b() {
        z = a(x*2);
    }
    
    function get(p){
        b();
        return p;
    }
    
    w.get = get; //export main function
})(window,5);


alert(get(1)); //get() is defined because it is set as a property of the window global context

alert(v); //v is not defined
*/