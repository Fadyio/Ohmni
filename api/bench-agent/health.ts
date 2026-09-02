import universalHandler from "../bench-agent";

export default universalHandler;
export const GET = (request: Request) => universalHandler(request);
export const POST = (request: Request) => universalHandler(request);
export const OPTIONS = (request: Request) => universalHandler(request);
