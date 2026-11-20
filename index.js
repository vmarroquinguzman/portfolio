
import {
  fetchJSON,
  renderProjects
} from './global.js';

import * as d3 from
  'https://cdn.jsdelivr.net/npm/d3@7/+esm';

// ==========================================
// LATEST PROJECTS
// ==========================================

const projects = await fetchJSON('./lib/projects.json');

const latestProjects = projects.slice(0, 3);

const projectsContainer =
  document.querySelector('.projects');

renderProjects(
  latestProjects,
  projectsContainer,
  'h2'
);

// ==========================================
// GITHUB OVERVIEW
// ==========================================

async function initializeGitHubOverview() {

  const status = document.querySelector(
    '#github-data-status'
  );

  try {
    const githubData = await fetchJSON(
      './lib/github-activity.json'
    );

    const profile = githubData.profile;

    const allCommits = githubData.commits.map((d) => ({
      ...d,
      datetime: new Date(d.date)
    }));

    // GitHub profile statistics
    d3.select('#profile-stats').html(`
      <dl>
        <dt>Public Repos</dt>
        <dd>${profile.repositories}</dd>

        <dt>Public Gists</dt>
        <dd>${profile.gists}</dd>

        <dt>Followers</dt>
        <dd>${profile.followers}</dd>

        <dt>Following</dt>
        <dd>${profile.following}</dd>
      </dl>
    `);

    // Repository dropdown
    const repoSelect = d3.select('#github-repository');

    repoSelect
      .selectAll('option.repo-option')
      .data(
        githubData.repositories
          .map((d) => d.name)
          .sort(d3.ascending)
      )
      .join('option')
      .attr('class', 'repo-option')
      .attr('value', (d) => d)
      .text((d) => d);

    // Update timestamp
    const updated = new Date(
      githubData.updatedAt
    ).toLocaleString('en-US', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'America/Los_Angeles'
    });

    const skipped =
      githubData.skippedRepositories || [];

    status.textContent =
      `Last updated: ${updated} PT` +
      (skipped.length
        ? ` · ${skipped.length} repositories unavailable`
        : '');

    // ======================================
    // FILTER DATA
    // ======================================

    function updateDashboard() {
      const period = Number(
        document.querySelector('#github-period').value
      );

      const repository = document.querySelector(
        '#github-repository'
      ).value;

      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - period);

      const filtered = allCommits.filter((d) =>
        d.datetime >= cutoff &&
        (
          repository === 'all' ||
          d.repository === repository
        )
      );

      renderActivityStats(filtered, period);
      renderRepositoryChart(filtered);
      renderGitHubHeatmap(filtered);
    }

    d3.select('#github-period')
      .on('change', updateDashboard);

    d3.select('#github-repository')
      .on('change', updateDashboard);

    updateDashboard();

  } catch (error) {
    console.error(error);

    status.textContent =
      'GitHub activity is currently unavailable.';
  }
}

// ==========================================
// ACTIVITY SUMMARY
// ==========================================

function renderActivityStats(commits, period) {

  const activeRepos = new Set(
    commits.map((d) => d.repository)
  ).size;

  const activeDays = new Set(
    commits.map((d) =>
      d.datetime.toLocaleDateString('en-US', {
        timeZone: 'America/Los_Angeles'
      })
    )
  ).size;

  d3.select('#github-activity-stats').html(`
    <div class="github-stat-card">
      <span>Commits</span>
      <strong>${commits.length}</strong>
      <small>Last ${period} days</small>
    </div>

    <div class="github-stat-card">
      <span>Active repositories</span>
      <strong>${activeRepos}</strong>
      <small>Selected period</small>
    </div>

    <div class="github-stat-card">
      <span>Active days</span>
      <strong>${activeDays}</strong>
      <small>Selected period</small>
    </div>
  `);
}

// ==========================================
// REPOSITORY BAR CHART
// ==========================================

function renderRepositoryChart(commits) {

  const container = d3.select('#repository-chart');

  container.selectAll('*').remove();

  const counts = d3.rollups(
    commits,
    (v) => v.length,
    (d) => d.repository
  )
  .sort((a, b) => b[1] - a[1]);

  const repoColors = d3.scaleOrdinal()
  .domain(counts.map((d) => d[0]))
  .range(d3.schemeTableau10);

  if (!counts.length) {
    container.append('p')
      .text('No recorded commits in this period.');

    return;
  }

  const x = d3.scaleLinear()
    .domain([0, d3.max(counts, (d) => d[1])])
    .range([0, 100]);

  const rows = container
    .selectAll('.repository-row')
    .data(counts)
    .join('div')
    .attr('class', 'repository-row');

  const labels = rows
    .append('div')
    .attr('class', 'repository-label');

  labels.append('span')
    .text((d) => d[0]);

  labels.append('strong')
    .text((d) => `${d[1]} commits`);

  rows.append('div')
    .attr('class', 'repository-track')
    .append('div')
    .attr('class', 'repository-bar')
    .style('background', (d) => repoColors(d[0]))
    .style('width', '0%')
    .transition()
    .duration(500)
    .style('width', (d) => `${x(d[1])}%`);
}

// ==========================================
// CODING ACTIVITY HEATMAP
// ==========================================

function renderGitHubHeatmap(commits) {

  const days = [
    'Mon', 'Tue', 'Wed',
    'Thu', 'Fri', 'Sat', 'Sun'
  ];

  const hours = d3.range(24);

  const formatter = new Intl.DateTimeFormat(
    'en-US',
    {
      timeZone: 'America/Los_Angeles',
      weekday: 'short',
      hour: '2-digit',
      hourCycle: 'h23'
    }
  );

  const activity = commits.map((d) => {
    const parts = Object.fromEntries(
      formatter.formatToParts(d.datetime)
        .map((p) => [p.type, p.value])
    );

    return {
      day: parts.weekday,
      hour: Number(parts.hour)
    };
  });

  const counts = d3.rollup(
    activity,
    (v) => v.length,
    (d) => d.day,
    (d) => d.hour
  );

  const cells = days.flatMap((day) =>
    hours.map((hour) => ({
      day,
      hour,
      count: counts.get(day)?.get(hour) || 0
    }))
  );

  const width = 800;
  const height = 270;

  const margin = {
    top: 10,
    right: 10,
    bottom: 35,
    left: 45
  };

  const container = d3.select('#github-heatmap');

  container.selectAll('*').remove();

  const svg = container.append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('width', '100%');

  const x = d3.scaleBand()
    .domain(hours)
    .range([margin.left, width - margin.right])
    .padding(0.12);

  const y = d3.scaleBand()
    .domain(days)
    .range([margin.top, height - margin.bottom])
    .padding(0.12);

  const maxCount = d3.max(
    cells, (d) => d.count
  ) || 1;

  const color = d3.scaleLinear()
    .domain([0, maxCount])
    .range(['#dbeafe', '#256eeb']);

  svg.selectAll('rect')
    .data(cells)
    .join('rect')
    .attr('x', (d) => x(d.hour))
    .attr('y', (d) => y(d.day))
    .attr('width', x.bandwidth())
    .attr('height', y.bandwidth())
    .attr('rx', 3)
    .attr('fill', (d) =>
      d.count === 0
        ? 'rgba(128,128,128,0.15)'
        : color(d.count)
    )
    .on('mouseenter', function(event, d) {
      d3.select(this)
        .attr('stroke', 'currentColor')
        .attr('stroke-width', 2);

      const hour = String(d.hour).padStart(2, '0');

      d3.select('#github-heatmap-info')
        .text(
          `${d.day} at ${hour}:00 PT — ` +
          `${d.count} ${d.count === 1 ? 'commit' : 'commits'}`
        );
    })
    .on('mouseleave', function() {
      d3.select(this)
        .attr('stroke', 'none');

      d3.select('#github-heatmap-info')
        .text('Hover over a cell to explore my activity.');
    });

  svg.append('g')
    .attr(
      'transform',
      `translate(0, ${height - margin.bottom})`
    )
    .call(
      d3.axisBottom(x)
        .tickValues([0, 4, 8, 12, 16, 20, 23])
        .tickFormat((d) =>
          `${String(d).padStart(2, '0')}:00`
        )
        .tickSize(0)
    )
    .call((g) => g.select('.domain').remove());

  svg.append('g')
    .attr('transform', `translate(${margin.left}, 0)`)
    .call(d3.axisLeft(y).tickSize(0))
    .call((g) => g.select('.domain').remove());

  // Heatmap legend
  const legend = d3.select('#github-heatmap-legend');

  legend.selectAll('*').remove();

  legend.append('span').text('No activity');

  legend.selectAll('.github-heatmap-swatch')
    .data(d3.range(6))
    .join('span')
    .attr('class', 'github-heatmap-swatch')
    .style('background', (d) =>
      d === 0
        ? 'rgba(128,128,128,0.15)'
        : color(maxCount * d / 5)
    );

  legend.append('span')
    .text(`${maxCount} commits`);
}

// Initialize the GitHub dashboard
initializeGitHubOverview();
