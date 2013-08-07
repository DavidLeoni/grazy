
interface Expr {        


    subst(x : Var, y : Expr);

}

class Var implements Expr {
    public label : string;
    constructor(label : string){        
        this.label = label;
    }
    
    /**
       x <- y
    */
    public subst(x : Var, y : Expr) : Expr{
        if (x === y){
            return x;
        } else {
            return y;
        }
    }
}

class Lambda implements Expr {
    public v : Var;
    public body : Expr;    
    public Lambda(v : Var, body : Expr){
        this.v = v;
        this.body = body;
    }
    
    public subst(x : Var, y : Expr) : Expr{
        if (this.v === x){
            return this;
        } else { 
            return new Lambda(this.v,new Apply(new Lambda(x,this.body),y));
        }
    }
    
}

function substapp(x : Var, y : Expr, body : Expr){
    return new Apply(new Lambda(x,body),y);
    
}

class Apply implements Expr {
    public f : Expr;
    public arg : Expr;
    public constructor(f : Expr, arg : Expr){
        this.f = f;
        this.arg = arg;
    }
    public exec() : Expr {
        if (this.f instanceof Var){
            return new Apply(this.f, this.arg.exec());
        } 
        
        if (this.f instanceof Apply){
            return new Apply(this.f.exec(), this.arg);
        } 
             
        return 
        
    }
    public subst(x : Var, y : Expr) : Expr{
        return new Apply(new Lambda(x, this.f), new Lambda())
    }
}