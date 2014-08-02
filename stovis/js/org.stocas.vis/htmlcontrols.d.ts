/// <reference path="../../../stolang/js/com.jquery/jquery.d.ts" />
interface Window {
    $: JQueryStatic;
}
interface JQuery {
    value: string;
}
declare class HTMLControls {
    public version: number;
    public radioControls: any;
    public checkboxControls: any;
    public buttonControls: any;
    public sliderControls: any;
    public registered: boolean;
    public setSelectedRadio(groupName: any, index: any): void;
    public addRadioControl(radioControlOptions: any): void;
    public addCheckboxControl(checkboxControlOptions: any): void;
    public addButtonControl(buttonControlOptions: any): void;
    public addSliderControl(sliderControlOptions: any): void;
    public getSliderValue(id: any): number;
    public getHandler(): (e: any) => void;
    public register(): void;
    public updateRadio(elementID: any, isSelected: any): void;
    public updateCheckbox(elementID: any, isSelected: any): void;
    public updateSlider(elementID: any, value: any): void;
    static create(): HTMLControls;
}
