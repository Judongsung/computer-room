import { FILE_ERRORS } from "../constants/errors/file";
import { AppError } from "./errors";

export class FileRangeNotSatisfiableError extends AppError {
  constructor(readonly totalSize: number) {
    super(FILE_ERRORS.RANGE_NOT_SATISFIABLE);
    this.name = "FileRangeNotSatisfiableError";
  }
}
