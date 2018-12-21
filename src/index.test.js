const test = require("ava");
const CLIUtils = require(".");

test("Testing basic exports", t => {
  let netlify;
  try {
    netlify = new CLIUtils();
  } catch (e) {
    t.fail(e);
  }
  t.true(
    netlify instanceof "NetlifyCLIUtils",
    "Can instantiate to the correct name"
  );
});
