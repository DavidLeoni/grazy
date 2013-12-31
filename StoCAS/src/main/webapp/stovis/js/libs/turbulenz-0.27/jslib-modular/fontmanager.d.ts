interface FontDimensions {
    width: number;
    height: number;
    numGlyphs: number;
    linesWidth: number[];
}
/**
@class  Font
@private

@since TurbulenzEngine 0.1.0
*/
declare class Font {
    static version: number;
    public bold: boolean;
    public italic: boolean;
    public pageWidth: number;
    public pageHeight: number;
    public baseline: any;
    public glyphs: any;
    public numGlyphs: number;
    public minGlyphIndex: number;
    public lineHeight: number;
    public pages: number;
    public kernings: any;
    public texture: Texture;
    public gd: GraphicsDevice;
    public fm: FontManager;
    constructor(gd: GraphicsDevice, fontManager: FontManager);
    public calculateTextDimensions(text, scale, spacing): {
        width: number;
        height: number;
        numGlyphs: number;
        linesWidth: any[];
    };
    public generateTextVertices(text, params);
    public drawTextRect(text, params): void;
    public drawTextVertices(vertices, reuseVertices?): void;
    public createIndexBuffer(maxGlyphs): IndexBuffer;
    public createVertexBuffer(maxGlyphs): VertexBuffer;
}
/**
@class  Font manager
@private

@since TurbulenzEngine 0.1.0
*/
declare class FontManager {
    static version: number;
    public fonts: {
        [name: string]: Font;
    };
    public load: (path: string, onFontLoaded?: (font: any) => void) => Font;
    public map: (dst: string, src: string) => void;
    public remove: (path: string) => void;
    public get(path: string): Font;
    public getAll: () => {
        [name: string]: Font;
    };
    public getNumPendingFonts: () => number;
    public isFontLoaded: (path: string) => boolean;
    public isFontMissing: (path: string) => boolean;
    public setPathRemapping: (prm: any, assetUrl: string) => void;
    public calculateTextDimensions: (path: string, text: string, scale: number, spacing: number) => FontDimensions;
    public reuseVertices: (vertices: any) => void;
    public destroy: () => void;
    public primitive: number;
    public primitiveFan: number;
    public semantics: Semantics;
    public techniqueParameters: TechniqueParameters;
    public sharedIndexBuffer: IndexBuffer;
    public sharedVertexBuffer: VertexBuffer;
    public reusableArrays: any;
    public float32ArrayConstructor: any;
    /**
    @constructs Constructs a FontManager object.
    
    @param {GraphicsDevice} gd Graphics device
    @param {RequestHandler} rh RequestHandler object
    
    @return {FontManager} object, null if failed
    */
    static create(gd: GraphicsDevice, rh: RequestHandler, df?: Font, errorCallback?: (msg: string) => void, log?: HTMLElement): FontManager;
}
