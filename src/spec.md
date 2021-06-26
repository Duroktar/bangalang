Lexer: string -> token[]

token:
    | STRING
    | NUMBER
    | PLUS = '+'


Parser: token[] -> ast

ast: expression

expression: binaryExpr

binaryExpr: literal op literal

literal:
    | token.STRING
    | token.NUMBER

op:
    | token.PLUS
