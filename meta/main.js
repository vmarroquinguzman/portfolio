import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

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


let commits = processCommits(data);


console.log(commits);



function renderCommitInfo(data, commits) {
  const container = d3.select('#stats');

  container.selectAll('*').remove();

  container.append('h2')
    .text('Summary');

  const dl = container.append('dl')
    .attr('class', 'stats');

  const stats = [
    { label: 'COMMITS', value: commits.length },
    { label: 'FILES', value: d3.group(data, d => d.file).size },
    { label: 'TOTAL LOC', value: data.length },
    { label: 'MAX DEPTH', value: d3.max(data, d => d.depth) },
    { label: 'LONGEST LINE', value: d3.max(data, d => d.length) },
    { label: 'MAX LINES', value: d3.max(commits, d => d.totalLines) },
  ];

  for (const stat of stats) {
    dl.append('dt').text(stat.label);
    dl.append('dd').text(stat.value);
  }
}


renderCommitInfo(data, commits);


function updateTooltipVisibility(isVisible) {
  const tooltip = document.getElementById('commit-tooltip');


  tooltip.hidden = !isVisible;
}


function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');


  tooltip.style.left = `${event.clientX}px`;
  tooltip.style.top = `${event.clientY}px`;
}



function createBrushSelector(svg, usableArea, commits, xScale, yScale) {

  function isCommitSelected(selection, commit) {
    if (!selection) {
      return false;
    }

    const [[x0, y0], [x1, y1]] = selection;

    const x = xScale(commit.datetime);
    const y = yScale(commit.hourFrac);

    return x >= x0 && x <= x1 && y >= y0 && y <= y1;
  }

  // Step 5.5: Show the count of selected commits
  function renderSelectionCount(selection) {
    const selectedCommits = selection
      ? commits.filter((d) => isCommitSelected(selection, d))
      : [];

    const countElement = document.querySelector('#selection-count');

    countElement.textContent = `${
      selectedCommits.length || 'No'
    } commits selected`;

    return selectedCommits;
  }

  // Step 5.6: Show language breakdown
  function renderLanguageBreakdown(selection) {
    const selectedCommits = selection
      ? commits.filter((d) => isCommitSelected(selection, d))
      : [];

    const container = document.getElementById('language-breakdown');

    if (selectedCommits.length === 0) {
      container.innerHTML = '';
      return;
    }

    const requiredCommits = selectedCommits.length
      ? selectedCommits
      : commits;

    const lines = requiredCommits.flatMap((d) => d.lines);

    // Use d3.rollup to count lines per language
    const breakdown = d3.rollup(
      lines,
      (v) => v.length,
      (d) => d.type,
    );

    // Update DOM with breakdown
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

  // Step 5.4: Handle brush events
  function brushed(event) {
    const selection = event.selection;

    svg.selectAll('.dots circle')
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

  svg
    .append('g')
    .attr('class', 'brush')
    .call(brush);

  // Step 5.2: Keep dots accessible for tooltips
  svg.selectAll('.dots, .overlay ~ *').raise();
}


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


  const xScale = d3
    .scaleTime()
    .domain(d3.extent(commits, (d) => d.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();


  const yScale = d3
    .scaleLinear()
    .domain([0, 24])
    .range([usableArea.bottom, usableArea.top]);


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


  const xAxis = d3.axisBottom(xScale);


  svg
    .append('g')
    .attr('class', 'x-axis')
    .attr(
      'transform',
      `translate(0, ${usableArea.bottom})`
    )
    .call(xAxis);


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


  const [minLines, maxLines] = d3.extent(
    commits,
    (d) => d.totalLines
  );


  const rScale = d3
    .scaleSqrt()
    .domain([minLines, maxLines])
    .range([2, 30]);


  const sortedCommits = d3.sort(
    commits,
    (d) => -d.totalLines
  );


  const dots = svg
    .append('g')
    .attr('class', 'dots');


  function renderTooltipContent(commit) {
    const link = document.getElementById('commit-link');


    link.href = commit.url;
    link.textContent = commit.id.slice(0, 7);


    document.getElementById('commit-date').textContent =
      commit.datetime.toLocaleDateString();


    document.getElementById('commit-time').textContent =
      commit.datetime.toLocaleTimeString();


    document.getElementById('commit-author').textContent =
      commit.author;


    document.getElementById('commit-lines').textContent =
      commit.totalLines;
  }


  dots
    .selectAll('circle')
    .data(sortedCommits)
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


  createBrushSelector(svg, usableArea, commits, xScale, yScale);
}


  renderScatterPlot(data, commits);


