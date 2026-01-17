import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    validatedQuery?: any;
    validatedBody?: any;
    validatedParams?: any;
    user?: any;
  }
}