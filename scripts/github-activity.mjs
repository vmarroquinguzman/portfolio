
import { writeFile, mkdir } from 'node:fs/promises';

const username = 'vmarroquinguzman';
const token = process.env.GITHUB_TOKEN;

const headers = {
  Accept: 'application/vnd.github+json',
  ...(token ? { Authorization: `Bearer ${token}` } : {})
};

async function githubRequest(path) {
  const response = await fetch(
    `https://api.github.com${path}`,
    { headers }
  );

  if (!response.ok) {
    throw new Error(
      `${response.status}: ${path}`
    );
  }

  return response.json();
}

async function getAllPages(path) {
  let results = [];
  let page = 1;

  while (true) {
    const separator = path.includes('?') ? '&' : '?';

    const batch = await githubRequest(
      `${path}${separator}per_page=100&page=${page}`
    );

    results.push(...batch);

    if (batch.length < 100) break;

    page++;
  }

  return results;
}

// GitHub profile information
const profile = await githubRequest(`/users/${username}`);

// Public repositories owned by you
const repositories = await getAllPages(
  `/users/${username}/repos?type=owner`
);

// Collect commits from the past year
const since = new Date();
since.setDate(since.getDate() - 365);

const commits = [];
const skippedRepositories = [];

for (const repo of repositories) {
  console.log(`Collecting data from ${repo.name}`);

  try {
    const repoCommits = await getAllPages(
      `/repos/${repo.full_name}/commits?` +
      `author=${username}&since=${since.toISOString()}`
    );

    for (const commit of repoCommits) {
      commits.push({
        sha: commit.sha,
        repository: repo.name,
        date: commit.commit.author.date,
        message: commit.commit.message,
        url: commit.html_url,
        language: repo.language || 'Other'
      });
    }

  } catch (error) {
    console.warn(
      `Could not collect ${repo.name}:`,
      error.message
    );

    skippedRepositories.push(repo.name);
  }
}

commits.sort(
  (a, b) => new Date(a.date) - new Date(b.date)
);

const output = {
  updatedAt: new Date().toISOString(),

  profile: {
    repositories: profile.public_repos,
    followers: profile.followers,
    following: profile.following,
    gists: profile.public_gists
  },

  repositories: repositories.map((repo) => ({
    name: repo.name,
    language: repo.language,
    url: repo.html_url,
    stars: repo.stargazers_count
  })),

  commits,
  skippedRepositories
};

await mkdir('lib', { recursive: true });

await writeFile(
  'lib/github-activity.json',
  JSON.stringify(output, null, 2)
);

console.log(
  `Saved ${commits.length} commits from GitHub.`
);
