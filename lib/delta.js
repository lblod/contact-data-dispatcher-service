import { NamedNode, triple } from "rdflib";
import flatten from "lodash.flatten";

export class Delta {
  constructor(delta) {
    this.delta = delta;
  }

  get inserts() {
    return flatten(this.delta.map((changeSet) => changeSet.inserts));
  }

  get deletes() {
    return flatten(this.delta.map((changeSet) => changeSet.deletes));
  }
}
