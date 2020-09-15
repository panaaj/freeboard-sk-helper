
export enum ALARM_STATE {
    nominal = 'nominal',
    normal = 'normal',
    alert = 'alert',
    warn = 'warn',
    alarm = 'alarm',
    emergency = 'emergency'
}

export enum ALARM_METHOD {
    visual = 'visual', 
    sound = 'sound'
}

export interface DeltaUpdate {
    updates: [{
        values: Array<DeltaMessage>
    }]
}

export interface DeltaMessage {
    path: string; 
    value: any;
}

export class Notification {

    public message: DeltaMessage= {
        path: `notifications.`,
        value: {
            state: ALARM_STATE.alarm,
            method: [ALARM_METHOD.sound, ALARM_METHOD.visual],
            message: 'Alarm!'
        }
    }

    constructor (path:string, msg:string, state?:ALARM_STATE, method?:Array<ALARM_METHOD>) {
        this.message.path+= path;
        this.message.value.message= msg;
        if(state) { this.message.value.state= state }
        if(method) { this.message.value.method= method }
    }
}


// ** watch a value within a range (min-max)
export class Watcher {
    public _rangeMin: number= 0;
    public _rangeMax: number= 100;
    private _sampleCount: number= 0;    // number of values sampled
    private _sampleSize: number= 1;     // number of values to sample before range test
    private _val:number= -1;

    constructor() { }

    set value(val:number) { 
        this._sampleCount++;
        this._setValue(val);
    }
    get value():number { return this._val}

    set rangeMax(val:number) { 
        this._rangeMax= (typeof val==='number') ? val : this._rangeMax;
    }
    get rangeMax():number { return this._rangeMax }

    set rangeMin(val:number) { 
        this._rangeMin= (typeof val==='number') ? val : this._rangeMin;
    }
    get rangeMin():number { return this._rangeMin }       

    set sampleSize(val:number) { 
        this._sampleSize= (typeof val==='number' && val>0 ) ? val : this._sampleSize;
        this._sampleCount= 0;
    }
    get sampleSize():number { return this._sampleSize }

    public isInRange(val:number= this._val):boolean {
        return (val<=this.rangeMax && val>=this.rangeMin) ? true : false;
    }

    private _setValue(val:number) {
        if(this._sampleCount < this._sampleSize) { return }
        if( this.isInRange(val) ) { //new value is in range
            if( !this.isInRange(this._val) ) { // ** was previously outside range
                //console.log(`In range (${val}), was previously outside range (${this._val})`);
                this.onEnterRange( val, (this._val<this.rangeMin) ? true : false );
            }
            else { // was already in range
                this.onUpdate(val);
            }
        }
        else {  // ** new value is out of range
            if( this.isInRange(this._val) ) { // ** was previously in range
                //console.log(`Out of range (${val}), was previously in range (${this._val})`);
                this.onExitRange( val, (val<this.rangeMin) ? true : false );
            }
            else { // was already out of range
                this.onUpdate(val);
            }
        }
        this._val= val;
        this._sampleCount= 0;
    }

    // ** onUpdate callback - new value in range **
    public onUpdate(val:number) { }
    // ** onEnterRange callback - fromBelow: true - prev value was below range **
    public onEnterRange(val:number, fromBelow?:boolean) { }
    // ** onExitRange callback - below: true - new value is below range **
    public onExitRange(val:number, below?:boolean) { }
}