export class ProcessingQueue {
  constructor(name = 'Default', config = {}) {
    this.name = name;
    this.queue = [];
    this.executing = false; //To avoid subtle race conditions TODO: is this required?
    this.run();
    this.readyToRun = false;
    this.config = config;
  }

  async run() {
    if (await this.checkReadyToRun()) {
      if (this.queue.length > 0 && !this.executing) {
        const job = this.queue.shift();
        try {
          this.executing = true;
          console.log(`${this.name}: Executing oldest task on queue`);
          await job.task();
          console.log(`${this.name}: Remaining number of tasks ${this.queue.length}`);
        }
        catch (error) {
          await job.onError(error);
        }
        finally {
          this.executing = false;
          this.run();
        }
      }
      else {
        setTimeout(() => { this.run(); }, (process.env.QUEUE_POLL_INTERVAL || 100));
      }
    }
    else {
      console.log(`${this.name}: Not yet ready to execute tasks (${this.queue.length}), waiting ...`);
      setTimeout(() => { this.run(); }, (process.env.INITIAL_SYNC_POLL_INTERVAL || 10000));
    }
  }

  async checkReadyToRun() {
    if (this.readyToRun) {
      return true
    } else {
      if (this.config && this.config.prerequisite) {
        console.log(`${this.name}: Checking prerequisite`);
        this.readyToRun = await this.config.prerequisite.ready();
      } else {
        console.log(`${this.name}: No prerequisite, ready to run`);
        this.readyToRun = true;
      }
      return this.readyToRun;
    }
  }

  addJob(subject, origin, onError = async (error) => { console.error(`${this.name}: Error while processing task`, error); }) {
    this.queue.push({
      subject,
      task: origin,
      onError: onError
    });
  }

  hasJobForSubject(subject) {
    return this.queue.find(job =>job.subject == subject);
  }
}
