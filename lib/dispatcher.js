// Courtesy to @bdevloed in https://github.com/bdevloed/consumer-dispatcher

import {
  moveSubjectsToPublicGraph,
  moveSubjectsToOrgGraphs
} from "./queries";

import { createJob, getLatestJobForOperation } from './job';
import { createJobError } from './error';
import { createTask } from './task';
import {
  INITIAL_DISPATCH_JOB_OPERATION,
  INITIAL_DISPATCH_TASK_OPERATION,
  JOB_CREATOR_URI,
  JOBS_GRAPH,
  STATUS_BUSY,
  STATUS_FAILED,
  STATUS_SCHEDULED,
  STATUS_SUCCESS,
} from '../constants';
import {
  dispatchToOrgGraphsConfig,
  dispatchToPublicGraphConfig
} from "../dispatch-config";

import { updateStatus } from "./queries";

export class Dispatcher {
  constructor(name) {
    this.name = name;
  }

  async initialDispatch() {
    let job;
    let task;

    try {
      let initialDispatchJob = await getLatestJobForOperation(INITIAL_DISPATCH_JOB_OPERATION, JOB_CREATOR_URI);

      if (initialDispatchJob && initialDispatchJob.status == STATUS_BUSY) {
        console.log(`Found job ${initialDispatchJob.job} with status busy, setting it to failed.`);
        await updateStatus(initialDispatchJob.job, STATUS_FAILED);
        initialDispatchJob.status = STATUS_FAILED;
      }

      if (!initialDispatchJob || initialDispatchJob.status == STATUS_FAILED) {
        // Note: they get status busy
        job = await createJob(JOBS_GRAPH, INITIAL_DISPATCH_JOB_OPERATION, JOB_CREATOR_URI, STATUS_BUSY);
        task = await createTask(JOBS_GRAPH, job, "0", INITIAL_DISPATCH_TASK_OPERATION, STATUS_SCHEDULED);

        // Dispatch to pubic graph
        for (const config of dispatchToPublicGraphConfig) {
          await moveSubjectsToPublicGraph(config);
        }

        for (const config of dispatchToOrgGraphsConfig) {
          await moveSubjectsToOrgGraphs(config);
        }

        await updateStatus(job, STATUS_SUCCESS);
        return job;
      } else {
        console.log(`Initial dispatch already done, skipping.`);
        return initialDispatchJob;
      }
    }
    catch (e) {
      console.log(`Something went wrong while doing the initial dispatch. Closing task with failure state.`);
      console.trace(e);
      if (task)
        await updateStatus(task, STATUS_FAILED);
      if (job) {
        await createJobError(JOBS_GRAPH, job, e);
        await updateStatus(job, STATUS_FAILED);
      }
      throw e;
    }
  }
}
