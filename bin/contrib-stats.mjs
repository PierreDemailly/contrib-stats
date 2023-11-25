#!/usr/bin/env node
/* eslint-disable max-len */

import "dotenv/config";

// Import Node.js Dependencies
import { EOL } from "node:os";

// Import Third-party Dependencies
import { request } from "@myunisoft/httpie";
import kleur from "kleur";

if (process.env.GITHUB_TOKEN === undefined) {
  throw new Error("Missing GITHUB_TOKEN env variable");
}

// CONSTANTS
const kGithubGraphQLAPI = "https://api.github.com/graphql";
const kRequestOptions = {
  headers: {
    authorization: `Bearer ${process.env.GITHUB_TOKEN}`
  }
};
const query = `
{
  viewer {
    login,
    repositoriesContributedTo(first: 100, contributionTypes: [COMMIT, PULL_REQUEST, REPOSITORY]) {
      totalCount
      nodes {
        nameWithOwner
      }
      pageInfo {
        endCursor
        hasNextPage
      }
    }
  }
}
`;
const { data } = await request("POST", kGithubGraphQLAPI, {
  body: { query },
  headers: kRequestOptions.headers
});
const { viewer: { login, repositoriesContributedTo } } = data.data;
const repositories = repositoriesContributedTo.nodes.map((node) => node.nameWithOwner);
const repositoriesReadmes = await Promise.all(repositories.map(async(repository) => {
  try {
    const response = await fetch(
      `https://raw.githubusercontent.com/${repository}/master/README.md`,
      {
        method: "GET",
        headers: kRequestOptions.headers
      }
    );

    return [repository, await response.text()];
  }
  catch {
    return [repository, null];
  }
}));

{
  const repositories = {
    total: 0,
    withoutReadme: [],
    withoutAllContributors: [],
    allContributorsNotListed: [],
    allContributorsListed: []
  };
  for (const [repo, readme] of repositoriesReadmes) {
    repositories.total++;

    if (readme === null) {
      repositories.withoutReadme.push(repo);
    }
    else if (readme.includes("ALL-CONTRIBUTORS") || readme.includes("allcontributors")) {
      if (readme.includes(login)) {
        repositories.allContributorsListed.push(repo);
      }
      else {
        repositories.allContributorsNotListed.push(repo);
      }
    }
    else {
      repositories.withoutAllContributors.push(repo);
    }
  }

  console.log(`${kleur.cyan().bold("Total projects contributed to:")} ${repositories.total}`);
  console.log(`${kleur.cyan().bold("Projects without README.md:")} ${repositories.withoutReadme.length || "None"}`);
  for (const repo of repositories.withoutReadme.sort()) {
    console.log(`- ${repo}`);
  }
  console.log(`${EOL}${kleur.cyan().bold("Projects not using all-contributors:")} ${repositories.withoutAllContributors.length || "None"}`);
  for (const repo of repositories.withoutAllContributors.sort()) {
    console.log(`- ${repo}`);
  }
  console.log(`${EOL}${kleur.cyan().bold(`Projects using all-contributors, but ${kleur.yellow(login)} not listed:`)} ${repositories.allContributorsNotListed.length || "None"}`);
  for (const repo of repositories.allContributorsNotListed.sort()) {
    console.log(`- ${repo}`);
  }
  console.log(`${EOL}${kleur.cyan().bold(`Projects using all-contributors, and ${kleur.yellow(login)} listed:`)} ${repositories.allContributorsListed.length || "None"}`);
  for (const repo of repositories.allContributorsListed.sort()) {
    console.log(`- ${repo}`);
  }
}
