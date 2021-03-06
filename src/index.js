#! /usr/bin/env node

const program = require("commander");
const chalk = require("chalk");
const axios = require("axios");
const ora = require("ora");
const pkg = require("../package.json");

const NEWS_API_URL = "https://newsapi.org";
const TOP_HEADLINES_URL = `${NEWS_API_URL}/v2/top-headlines`;
const SOURCES_URL = `${NEWS_API_URL}/v2/sources`;
const SEARCH_URL = `${NEWS_API_URL}/v2/everything`;
const API_KEY = process.env.API_KEY || "72ef587891b7421ab53dd1711732e327";


/**
 * getLatestStories
 *
 * Get news stories from a given source.
 *
 * @param source - the source id to get the news stories from.
 * @returns {Array} a list of the stories
 */
async function getLatestStories(source, limit) {
  const stories = await axios({
    url: TOP_HEADLINES_URL,
    params: {
      apiKey: API_KEY,
      sources: [source],
      pageSize: Math.min(100, limit)
    }
  });

  return stories.data.articles;
}

/**
 * getNewsSources
 *
 * Get all the possible news sources from the News API.
 *
 * @param category - category to show sources for. Defaults to all. 
 * @returns {Array} an array of news sources.
 */
async function getNewsSources(category) {
  const sources = await axios({
    url: SOURCES_URL,
    params: {
      apiKey: API_KEY,
      category
    }
  });

  return sources.data.sources;
}

/**
 * searchStories
 *
 * Pulls the latest news stories from all sources, returning the ones
 * that have titles matching the given search criteria.
 *
 * @param searchTerm - The string to search for.
 * @returns {Array} the list of stories matching the search criteria.
 */
async function searchStories(searchTerm) {
  const stories = await axios({
    url: SEARCH_URL,
    params: {
      apiKey: API_KEY,
      q: encodeURIComponent(searchTerm) 
    }
  });
  return stories.data.articles;
}

/**
 * printStories
 *
 * Pretty-prints a list of news stories.
 * @param stories - list of stories to print to console.
 * @returns {undefined}
 */
function printStories(stories) {
  if (stories.length === 0) {
    console.log(chalk.bold.red("\n No results found."));
    return;
  }

  stories.forEach(({ author, title, description, url, publishedAt }) => {
    console.log(chalk.bold.underline.yellow(title));
    console.log(`by ${chalk.green(author)}`);
    console.log(chalk.italic(description));
    console.log(`${chalk.bold("Link:")} ${chalk.cyan(url)}`);
    console.log(
      `${chalk.bold("Published")} ${chalk
        .red(new Date(publishedAt))
        .toLocaleString()} \n`
    );
  });
}


/**
 * printSources
 *
 * pretty-prints an array of news sources to the console. 
 *
 * @param sources - Array of news-sources objects
 * @returns {undefined}
 */
function printSources(sources) {
  sources.forEach(
    ({ name, description, url, category, language, country, id }) => {
      console.log(chalk.bold.underline.green(name));
      console.log(
        `${chalk.bold("Fetch Id (use this to get stories)")}: ${chalk.bold.cyan(
          id
        )}`
      );
      console.log(chalk.italic(description));
      console.log(`${chalk.bold("Website URL:")} ${chalk.cyan(url)}`);
      console.log(`${chalk.bold("Language")} ${language}`);
      console.log(`${chalk.bold("Country")} ${country} \n`);
    }
  );
}


/**
 * throwError
 *
 * Throw an error that is formatted with chalk and stop the loading spinner.
 *
 * @param error - the error string to show.
 * @param spinner - the spinner instance currently loading.
 * @returns {undefined}
 */
function throwError(error, spinner) {
  console.error("\n" + chalk.bold.red(error));
  spinner.stop();
}


program
  .version(pkg.version)
  .usage("[command] [<args>]");


program
  .command("fetch <source>")
  .description("get news stories from a chosen source.")
  .option(
    "-l, --limit <limit>",
    "limit the amount of news stories you want to see."
  )
  .action(function(source, { limit }) {
    const spinner = ora(
      chalk.green(
        "fetching latest stories from " +
          chalk.bold.underline.green.bgBlue(source)
      )
    ).start();

    getLatestStories(source, limit)
      .then(stories => {
        spinner.stop();
        console.log(limit);

        printStories(stories);
      })
      .catch(err => {
        throwError(
          "There has been a problem fetching your news stories. Please try again later.",
          spinner
        );
      });
  });


program
  .command("sources")
  .description("Show all the sources that you can get news from.")
  .option(
    "-c, --category <category>",
    "category of sources you want to see. Choices include: business, entertainment, gaming, general, music, politics, science-and-nature, sport, technology."
  )
  .action(({ category }) => {
    const spinner = ora("Fetching news sources..").start();

    getNewsSources(category)
      .then(sources => {
        console.log(
          `We currently support these ${chalk.bold(
            sources.length
          )} news sources: \n`
        );
        printSources(sources);
        spinner.stop();
      })
      .catch(() => {
        throwError(
          "There has been a problem fetching your news sources. Please try again later."
        );
        spinner.stop();
      });
  });


program
  .command("search <term>")
  .description(
    "Find news stories from all sources that match the search criteria"
  )
  .action(function(term) {
    const spinner = ora(
      `Scraping all news sources for stories that match term ${chalk.bold(
        term
      )}...`
    ).start();

    searchStories(term)
      .then(printStories)
      .then(() => spinner.stop())
      .catch(err => {
        if (err.response.status === 403) {
          throwError(
            "You have hit the rate limit on the News API. Please try again later.",
            spinner
          );
        } else {
          throwError(
            "There has been a problem executing your search. Please try again later.",
            spinner
          );
        }
      });
  });


program.parse(process.argv);

if (!program.args.length) {
  program.help();
}
