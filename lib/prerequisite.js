// Courtesy to @bdevloed in https://github.com/bdevloed/consumer-dispatcher

import { Dispatcher } from './dispatcher.js';
import { isDatabaseUp } from './database.js';
import { allInitialSyncsDone } from './queries.js';

export class Prerequisite {
  constructor() {
    this._ready = false;
    this.initialDispatchBusy = false;
    this.dispatcher = new Dispatcher('initial_dispatch');
    this.dbUp = false;
  }

  async ready() {
    if (this._ready) {
      return this._ready;
    } else {
      if (!this.dbUp) {
        this.dbUp = await isDatabaseUp();
        if (!this.dbUp) {
          console.log("Waiting for database... ")
          return false;
        }
      }

      let syncs_done = await allInitialSyncsDone();
      if (syncs_done) {
        if (!this.initialDispatchBusy) {
          console.log("Initial syncs done, starting initial dispatch");
          this.initialDispatchBusy = true;
          this._ready = await this.dispatcher.initialDispatch();
          this.initialDispatchBusy = false;
          return this._ready;
        } else {
          console.log("Initial dispatch already running, waiting for it to finish");
          return false;
        }
      } else {
        console.log("Waiting for initial syncs to finish... ");
        return false;
      }
    }
  }
}
