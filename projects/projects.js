import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');
const projectsTitle = document.querySelector('.projects-title');
const searchInput = document.querySelector('.searchBar');

// Step 5: Track selected year and search query
let selectedIndex = -1;
let selectedYear = null;
let query = '';

// Create consistent colors for each year
let years = [...new Set(projects.map(d => String(d.year)))].sort();

let colors = d3.scaleOrdinal()
  .domain(years)
  .range(d3.quantize(d3.interpolateBlues, Math.max(3, years.length)));

// Function to render the pie chart
function renderPieChart(projectsGiven) {

  // Group projects by year
  let rolledData = d3.rollups(
    projectsGiven,
    (v) => v.length,
    (d) => d.year,
  );

  // Convert grouped data into pie chart format
  let data = rolledData.map(([year, count]) => {
    return { value: count, label: year };
  });

  // Generate pie slices
  let sliceGenerator = d3.pie().value((d) => d.value);
  let arcData = sliceGenerator(data);

  // Generate arcs
  let arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
  let arcs = arcData.map((d) => arcGenerator(d));

  // Select SVG and clear previous paths
  let svg = d3.select('#projects-pie-plot');
  svg.selectAll('path').remove();

  // Select legend and clear previous items
  let legend = d3.select('.legend');
  legend.selectAll('li').remove();

  // Step 5.2: Update selected slice and legend
  function updateSelection() {

    svg.selectAll('path')
      .classed('selected', (d, idx) =>
        selectedYear !== null &&
        String(data[idx].label) === selectedYear
      );

    legend.selectAll('li')
      .classed('selected', (d, idx) =>
        selectedYear !== null &&
        String(data[idx].label) === selectedYear
      );
  }

  // Step 5.3: Handle clicking a year
  function selectYear(year, index) {

    if (selectedYear === String(year)) {
      selectedYear = null;
      selectedIndex = -1;
    } else {
      selectedYear = String(year);
      selectedIndex = index;
    }

    updateSelection();
    updateProjects();
  }

  // Draw pie chart
  arcs.forEach((arc, idx) => {

    svg
      .append('path')
      .attr('d', arc)
      .attr('fill', colors(String(data[idx].label)))
      .on('click', () => {
        selectYear(data[idx].label, idx);
      });

  });

  // Draw legend
  data.forEach((d, idx) => {

    legend
      .append('li')
      .attr('style', `--color:${colors(String(d.label))}`)
      .attr('class', 'legend-item')
      .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`)
      .on('click', () => {
        selectYear(d.label, idx);
      });

  });

  updateSelection();
}

// Step 5.4: Combine search and year filters
function updateProjects() {

    // First filter by search
    let filteredProjects = projects.filter((project) => {
        let values = Object.values(project).join('\n').toLowerCase();
        return values.includes(query.toLowerCase());
    });

    // Update pie chart based on search results
    renderPieChart(filteredProjects);

    // Then filter by selected year
    if (selectedYear !== null) {
        filteredProjects = filteredProjects.filter(
            (project) => String(project.year) === selectedYear
        );
    }

    // Display filtered projects
    renderProjects(filteredProjects, projectsContainer, 'h2');
}

// Initial render
projectsTitle.textContent = `${projects.length} Projects`;
updateProjects();

// Search bar event listener
searchInput.addEventListener('input', (event) => {

  query = event.target.value;

  // Clear selection if selected year has no matching projects
  let matchingProjects = projects.filter((project) => {
    let values = Object.values(project).join('\n').toLowerCase();
    return values.includes(query.toLowerCase());
  });

  if (
    selectedYear !== null &&
    !matchingProjects.some(
      (project) => String(project.year) === selectedYear
    )
  ) {
    selectedYear = null;
    selectedIndex = -1;
  }

  updateProjects();
});