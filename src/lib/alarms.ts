import { ALARM_METHOD, ALARM_STATE, DeltaNotification } from '@panaaj/sk-types';

export class Notification {

    private _message: DeltaNotification= {
        path: `notifications.`,
        value: {
            state: ALARM_STATE.alarm,
            method: [ALARM_METHOD.sound, ALARM_METHOD.visual],
            message: 'Alarm!'
        }
    }

    constructor (path:string, msg:string, state?:ALARM_STATE, method?:Array<ALARM_METHOD>) {
        this._message.path+= path;
        this._message.value.message= msg;
        if(state) { this._message.value.state= state }
        if(method) { this._message.value.method= method }
    }

    get message():DeltaNotification { return this._message }
}


// ** manage notification transmission **
export class Notifier {
    private _period:number= 30000;    //number of milliseconds to emit notification
    public notification: Notification | undefined;
    private _timer: any= null;

    constructor() { }

    set period(val:number) { 
        if(typeof val== 'number' && val>=500) {
            this._period= val;
            if(this._timer) { this.start() }    // restart
        }
            
    }
    get period():number { return this._period }

    start() {
        this.stop();
        this._timer= setInterval(
            ()=> { 
                if(this.notification) { this.notify(this.notification.message) }
            },
            this._period
        );
    }

    stop() { 
        if(this._timer) { 
            clearInterval(this._timer);
            this._timer= null;
        } 
    }
    // callback 
    public notify(msg:any) { if(msg) { console.log(msg) } }
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
        return typeof val=='number' && (val<=this.rangeMax && val>=this.rangeMin) ? true : false;
    }

    private _setValue(val:number) {
        if(this._sampleCount < this._sampleSize) { return }
        if(typeof val!=='number') {
            this.onExitRange( val);
            return;
        }
        if( this.isInRange(val) ) { //new value is in range
            if( !this.isInRange(this._val) ) { // ** was previously outside range
                this.onEnterRange( val, (this._val<this.rangeMin) ? true : false );
            }
            else { // was already in range
                this.onInRange(val);
            }
        }
        else {  // ** new value is out of range
            if( this.isInRange(this._val) ) { // ** was previously in range
                this.onExitRange( val, (val<this.rangeMin) ? true : false );
            }
        }
        this._val= val;
        this._sampleCount= 0;
    }

    /** onInRange callback - raised when supplied value is in range 
     *                       and previous value was also in range.
     * @param val: current value
     * **/
    public onInRange(val:number) { }

    /** onEnterRange callback - raised when previous value was out of range 
     *                          and new value is in range.
     * @param val: current value
     * @param fromBelow: true - previous value was below range, false - previous value was above range
     * **/
    public onEnterRange(val:number, fromBelow?:boolean) { }

    /** onExitRange callback - raised when previous value was in range 
     *                          and current value is out of range.
     * @param val: current value
     * @param below: true - current value is below range, false - current value is above range 
    **/
    public onExitRange(val:number, below?:boolean) { }
}