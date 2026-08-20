import { toNestErrors, validateFieldsNatively } from "@hookform/resolvers";
import type {
  FieldError,
  FieldErrors,
  FieldValues,
  Resolver,
} from "react-hook-form";
import type { z } from "zod";

interface ZodIssueLike {
  code: string;
  message: string;
  path: (number | string)[];
  unionErrors?: { errors?: ZodIssueLike[]; issues?: ZodIssueLike[] }[];
}

const parseIssues = (
  issues: ZodIssueLike[],
  validateAllFieldCriteria: boolean
): Record<string, FieldError> => {
  const errors: Record<string, FieldError> = {};

  for (const issue of issues) {
    const path = issue.path.join(".");

    if (!errors[path]) {
      if (issue.unionErrors && issue.unionErrors.length > 0) {
        const unionIssue =
          issue.unionErrors[0]?.issues?.[0] ??
          issue.unionErrors[0]?.errors?.[0];
        errors[path] = {
          message: unionIssue?.message ?? issue.message,
          type: unionIssue?.code ?? issue.code,
        };
      } else {
        errors[path] = {
          message: issue.message,
          type: issue.code,
        };
      }
    }

    if (validateAllFieldCriteria) {
      const currentError = errors[path],
        existingMessages = currentError.types?.[issue.code],
        previousMessages = Array.isArray(existingMessages)
          ? existingMessages.filter(
              (message): message is string => typeof message === "string"
            )
          : (typeof existingMessages === "string"
            ? [existingMessages]
            : []),
        message =
          previousMessages.length > 0
            ? [...previousMessages, issue.message]
            : issue.message;

      errors[path] = {
        ...currentError,
        types: {
          ...currentError.types,
          [issue.code]: message,
        },
      };
    }
  }

  return errors;
};

export const zodResolver =
  <T extends z.ZodType<FieldValues, FieldValues>>(
    schema: T,
    schemaOptions?: Parameters<T["parse"]>[1],
    resolverOptions: { mode?: "async" | "sync"; raw?: boolean } = {}
  ): Resolver<z.output<T>> =>
  async (values, _context, options) => {
    try {
      const parsedValues = await schema.parseAsync(values, schemaOptions);

      if (options.shouldUseNativeValidation) {
        validateFieldsNatively({}, options);
      }

      return {
        errors: {},
        values: (resolverOptions.raw ? values : parsedValues) as z.output<T>,
      };
    } catch (error: unknown) {
      const issues =
        (error as { issues?: ZodIssueLike[] })?.issues ??
        (error as { errors?: ZodIssueLike[] })?.errors;

      if (Array.isArray(issues)) {
        return {
          errors: toNestErrors(
            parseIssues(
              issues,
              !options.shouldUseNativeValidation &&
                options.criteriaMode === "all"
            ),
            options
          ) as FieldErrors<z.output<T>>,
          values: {} as Record<string, never>,
        };
      }

      throw error;
    }
  };
