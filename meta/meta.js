import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

// Load data
async function loadData() {
  const data = await d3.csv('loc.csv', (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(row.date + 'T00:00' + row.timezone),
    datetime: new Date(row.datetime),
  }));

  return data;
}

let data = await loadData();

// Process commits
function processCommits(data) {
  return d3
    .groups(data, (d) => d.commit)
    .map(([commit, lines]) => {
      let first = lines[0];

      let {
        author,
        date,
        time,
        timezone,
        datetime
      } = first;

      let ret = {
        id: commit,
        url: `https://github.com/vmarroquinguzman/portfolio/commit/${commit}`,
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac:
          datetime.getHours() +
          datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      Object.defineProperty(ret, 'lines', {
        value: lines,
        configurable: true,
        writable: true,
        enumerable: false,
      });

      return ret;
    });
}

let commits = processCommits(data).sort(
  (a,b) => a.datetime - b.datetime
);

// ==========================================
// LAB 8 - STEP 1.1: Creating the filtering UI
// ==========================================

let commitProgress = 100;

let timeScale = d3
  .scaleTime()
  .domain([
    d3.min(commits, (d) => d.datetime),
    d3.max(commits, (d) => d.datetime),
  ])
  .range([0, 100]);

let commitMaxTime = timeScale.invert(commitProgress);

// LAB 8 - Step 1.2: Filtered commits
let filteredCommits = commits;
// ==========================================
// LAB 8 - STEP 2.1: File visualization
// ==========================================

function updateFileDisplay(filteredCommits) {
  let lines = filteredCommits.flatMap((d) => d.lines);

  let files = d3
    .groups(lines, (d) => d.file)
    .map(([name, lines]) => {
      return { name, lines };
    })
    .sort((a,b) => b.lines.length - a.lines.length);

  let filesContainer = d3
    .select('#files')
    .selectAll(':scope > div')
    .data(files, (d) => d.name)
    .join(
      (enter) =>
        enter.append('div').call((div) => {
          div.append('dt').append('code');
          div.append('dd');
        })
    );

  let colors = d3.scaleOrdinal(d3.schemeTableau10);
  // Display filename and total line count
  filesContainer
    .select('dt')
    .html(
      (d) => `
        <code>${d.name}</code>
        <small>${d.lines.length} lines</small>
      `
    );

  // Step 2.2: Create one dot for each line
  filesContainer
    .select('dd')
    .selectAll('div')
    .data((d) => d.lines)
    .join('div')
    .attr('class', 'loc')
    .attr('style', (d) => `--color: ${colors(d.type)}`);
}

// Shared scales
let xScale;
let yScale;

// Function for clearing the brush selection
let clearBrushSelection = () => {};

function onTimeSliderChange() {
  commitProgress = Number(
    document.getElementById('commit-progress').value
  );

  commitMaxTime = timeScale.invert(commitProgress);

  document.getElementById('commit-time').textContent =
    commitMaxTime.toLocaleString('en-US', {
      dateStyle: 'long',
      timeStyle: 'short',
    });

  // Step 1.2: Filter commits by selected time
  filteredCommits = commits.filter(
    (d) => d.datetime <= commitMaxTime
  );

  updateScatterPlot(data, filteredCommits);

  // Update summary statistics
  renderCommitInfo(
    filteredCommits.flatMap((d) => d.lines),
    filteredCommits
  );
  // Lab 8 - Step 2.1
  updateFileDisplay(filteredCommits);
}

// ==========================================
// SUMMARY STATISTICS
// ==========================================

function renderCommitInfo(data, commits) {
  const container = d3.select('#stats');

  container.selectAll('*').remove();

  container
    .append('h2')
    .text('Summary');

  const dl = container
    .append('dl')
    .attr('class', 'stats');

  const stats = [
    {
      label: 'COMMITS',
      value: commits.length
    },
    {
      label: 'FILES',
      value: d3.group(data, (d) => d.file).size
    },
    {
      label: 'TOTAL LOC',
      value: data.length
    },
    {
      label: 'MAX DEPTH',
      value: d3.max(data, (d) => d.depth)
    },
    {
      label: 'LONGEST LINE',
      value: d3.max(data, (d) => d.length)
    },
    {
      label: 'MAX LINES',
      value: d3.max(commits, (d) => d.totalLines)
    },
  ];

  for (const stat of stats) {
    dl.append('dt').text(stat.label);
    dl.append('dd').text(stat.value);
  }
}

// ==========================================
// TOOLTIP FUNCTIONS
// ==========================================

function updateTooltipVisibility(isVisible) {
  const tooltip = document.getElementById('commit-tooltip');

  tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');

  tooltip.style.left = `${event.clientX}px`;
  tooltip.style.top = `${event.clientY}px`;
}

function renderTooltipContent(commit) {
  const link = document.getElementById('commit-link');

  link.href = commit.url;
  link.textContent = commit.id.slice(0, 7);

  document.getElementById('commit-date').textContent =
    commit.datetime.toLocaleDateString();

  document.getElementById('tooltip-commit-time').textContent =
    commit.datetime.toLocaleTimeString();

  document.getElementById('commit-author').textContent =
    commit.author;

  document.getElementById('commit-lines').textContent =
    commit.totalLines;
}

// ==========================================
// BRUSH SELECTION
// ==========================================

function createBrushSelector(
  svg,
  usableArea,
  commits,
  xScale,
  yScale
) {
  function isCommitSelected(selection, commit) {
    if (!selection) {
      return false;
    }

    const [[x0, y0], [x1, y1]] = selection;

    const x = xScale(commit.datetime);
    const y = yScale(commit.hourFrac);

    return (
      x >= x0 &&
      x <= x1 &&
      y >= y0 &&
      y <= y1
    );
  }

  // Show the count of selected commits
  function renderSelectionCount(selection) {
    const selectedCommits = selection
      ? filteredCommits.filter(
          (d) => isCommitSelected(selection, d)
        )
      : [];

    const countElement =
      document.querySelector('#selection-count');

    countElement.textContent = `${
      selectedCommits.length || 'No'
    } commits selected`;

    return selectedCommits;
  }

  // Show language breakdown
  function renderLanguageBreakdown(selection) {
    const selectedCommits = selection
      ? filteredCommits.filter(
          (d) => isCommitSelected(selection, d)
        )
      : [];

    const container =
      document.getElementById('language-breakdown');

    if (selectedCommits.length === 0) {
      container.innerHTML = '';
      return;
    }

    const lines = selectedCommits.flatMap(
      (d) => d.lines
    );

    const breakdown = d3.rollup(
      lines,
      (v) => v.length,
      (d) => d.type
    );

    container.innerHTML = '';

    for (const [language, count] of breakdown) {
      const proportion = count / lines.length;
      const formatted = d3.format('.1~%')(proportion);

      container.innerHTML += `
        <dt>${language}</dt>
        <dd>${count} lines (${formatted})</dd>
      `;
    }
  }

  // Handle brush events
  function brushed(event) {
    const selection = event.selection;

    svg
      .selectAll('.dots circle')
      .classed('selected', (d) =>
        isCommitSelected(selection, d)
      );

    renderSelectionCount(selection);
    renderLanguageBreakdown(selection);
  }

  const brush = d3
    .brush()
    .extent([
      [usableArea.left, usableArea.top],
      [usableArea.right, usableArea.bottom]
    ])
    .on('start brush end', brushed);

  const brushGroup = svg
    .append('g')
    .attr('class', 'brush')
    .call(brush);

  clearBrushSelection = () => {
    brushGroup.call(brush.move, null);
  };

  // Keep dots accessible for tooltips
  svg.selectAll('.dots, .overlay ~ *').raise();
}

// ==========================================
// RENDER INITIAL SCATTER PLOT
// ==========================================

function renderScatterPlot(data, commits) {
  const width = 1000;
  const height = 600;

  const margin = {
    top: 10,
    right: 10,
    bottom: 30,
    left: 20,
  };

  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  const svg = d3
    .select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .style('overflow', 'visible');

  // X scale
  xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();

  // Y scale
  yScale = d3
    .scaleLinear()
    .domain([0, 24])
    .range([usableArea.bottom, usableArea.top]);

  // Gridlines
  const gridlines = svg
    .append('g')
    .attr('class', 'gridlines')
    .attr(
      'transform',
      `translate(${usableArea.left}, 0)`
    );

  gridlines.call(
    d3
      .axisLeft(yScale)
      .tickFormat('')
      .tickSize(-usableArea.width)
  );

  // X axis
  const xAxis = d3.axisBottom(xScale);

  svg
    .append('g')
    .attr('class', 'x-axis')
    .attr(
      'transform',
      `translate(0, ${usableArea.bottom})`
    )
    .call(xAxis);

  // Y axis
  const yAxis = d3
    .axisLeft(yScale)
    .tickFormat(
      (d) => String(d % 24).padStart(2, '0') + ':00'
    );

  svg
    .append('g')
    .attr('class', 'y-axis')
    .attr(
      'transform',
      `translate(${usableArea.left}, 0)`
    )
    .call(yAxis);

  // Scale circle sizes
  const [minLines, maxLines] = d3.extent(
    commits,
    (d) => d.totalLines
  );

  const rScale = d3
    .scaleSqrt()
    .domain([minLines, maxLines])
    .range([2, 30]);

  // Sort commits by size
  const sortedCommits = d3.sort(
    commits,
    (d) => -d.totalLines
  );

  const dots = svg
    .append('g')
    .attr('class', 'dots');

  // Draw circles
  dots
    .selectAll('circle')
    .data(sortedCommits, (d) => d.id)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7)

    .on('mouseenter', (event, commit) => {
      d3
        .select(event.currentTarget)
        .style('fill-opacity', 1);

      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })

    .on('mouseleave', (event) => {
      d3
        .select(event.currentTarget)
        .style('fill-opacity', 0.7);

      updateTooltipVisibility(false);
    });

  createBrushSelector(
    svg,
    usableArea,
    commits,
    xScale,
    yScale
  );
}

// ==========================================
// LAB 8 - STEP 1.2: Update scatter plot
// ==========================================

function updateScatterPlot(data, commits) {
  const svg = d3
    .select('#chart')
    .select('svg');

  // Reset previous selection and tooltip
  clearBrushSelection();
  updateTooltipVisibility(false);

  // Update the existing x scale
  xScale.domain(
    d3.extent(commits, (d) => d.datetime)
  );

  // Update circle size scale
  const [minLines, maxLines] = d3.extent(
    commits,
    (d) => d.totalLines
  );

  const rScale = d3
    .scaleSqrt()
    .domain([minLines, maxLines])
    .range([2, 30]);

  const xAxis = d3.axisBottom(xScale);

  // Update existing x-axis instead of creating another
  const xAxisGroup = svg.select('g.x-axis');

  xAxisGroup.selectAll('*').remove();
  xAxisGroup.call(xAxis);

  // Select existing dots group
  const dots = svg.select('g.dots');

  const sortedCommits = d3.sort(
    commits,
    (d) => -d.totalLines
  );

  // Update circles using filtered commits
  dots
    .selectAll('circle')
    .data(sortedCommits, (d) => d.id)
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7)

    .on('mouseenter', (event, commit) => {
      d3
        .select(event.currentTarget)
        .style('fill-opacity', 1);

      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })

    .on('mouseleave', (event) => {
      d3
        .select(event.currentTarget)
        .style('fill-opacity', 0.7);

      updateTooltipVisibility(false);
    });
}

// ==========================================
// INITIALIZE PAGE
// ==========================================

// Render the initial statistics and scatter plot
renderCommitInfo(data, commits);
renderScatterPlot(data, commits);

// Connect slider to event listener
document
  .getElementById('commit-progress')
  .addEventListener('input', onTimeSliderChange);

// Initialize slider date and time
onTimeSliderChange();

console.log(commits);

// ==========================================
// LAB 8 - STEP 3.2: Generate commit text
// ==========================================

d3.select('#scatter-story')
  .selectAll('.step')
  .data(commits)
  .join('div')
  .attr('class', 'step')
  .html(
    (d, i) => `
      On ${d.datetime.toLocaleString('en', {
        dateStyle: 'full',
        timeStyle: 'short',
      })}, I made
      <a href="${d.url}" target="_blank">
        ${i > 0 ? 'another commit' : 'my first commit'}
      </a>
      to my portfolio website.

      I edited ${d.totalLines} lines across ${
        d3.rollups(
          d.lines,
          (D) => D.length,
          (d) => d.file
        ).length
      } files.
    `
  );
// ==========================================
// LAB 8 - STEP 3.3: Scrollytelling
// ==========================================

function onStepEnter(response) {
  const commit = response.element.__data__;

  commitMaxTime = commit.datetime;

  commitProgress = timeScale(commitMaxTime);

  document.getElementById('commit-progress').value =
    commitProgress;

  onTimeSliderChange();
}

const scroller = scrollama();

scroller
  .setup({
    container: '#scrolly-1',
    step: '#scrolly-1 .step',
  })
  .onStepEnter(onStepEnter);

window.addEventListener('resize', () => {
  scroller.resize();
});