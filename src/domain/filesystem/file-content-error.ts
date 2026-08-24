import { FILE_ERRORS } from "@/constants/filesystem/errors/file";
import { AppError } from "@/domain/shared/errors";

export class FileRangeNotSatisfiableError extends AppError {
  constructor(readonly totalSize: number) {
    super(FILE_ERRORS.RANGE_NOT_SATISFIABLE);
    this.name = "FileRangeNotSatisfiableError";
  }
}
