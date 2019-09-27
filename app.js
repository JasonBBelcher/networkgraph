function convertLatLongToXY(path, options, username, password) {
	let smallestLat = null;
	let smallestLong = null;
	let largestX = null;
	let largestY = null;



	return new Promise((resolve, reject) => {
		fetch(path, {
				headers: new Headers({
					Authorization: `Basic ${btoa(username + ':' + password )}`
				})
			})
			.then((res) => res.json())
			.then((data) => {
				let nodes = data.graph.nodes;
				let edges = data.graph.edges;

				var nodeList = [];
				nodes.forEach(function (node) {
					nodeList[node.id] = node;
				});
				edges.forEach(function (edge) {
					edge.source = nodeList[edge.source];
					edge.target = nodeList[edge.target];
				});

				nodes = nodes.filter(n => n.metadata.is_virtual === false);
				nodes = nodes.map((n) => {
					return {
						id: n.id,
						metadata: n.metadata
					}
				})

				// limit to a small local area so that all nodes will be spread out and viewable. 
				nodes = nodes.filter(n => n.metadata.longitude.toFixed(0) == -84 && n.metadata.latitude.toFixed(0) <= 34)



				// get smallest lat/long
				nodes.forEach((node) => {
					if (!smallestLat || node.metadata.latitude < smallestLat) {
						smallestLat = node.metadata.latitude;
					}
					if (!smallestLong || node.metadata.longitude < smallestLong) {
						smallestLong = node.metadata.longitude;
					}
				});

				// scale lat/longs

				nodes.forEach((node) => {
					if (
						typeof node.metadata.latitude === 'number' ||
						typeof node.metadata.longitude === 'number'
					) {
						node.metadata.x =
							(1000000 * node.metadata.latitude) - (1000000 * smallestLat);
						node.metadata.y =
							(1000000 * node.metadata.longitude) - (1000000 * smallestLong);
					}

				});



				// get largest lat/long

				nodes.forEach((node) => {
					if (!largestX || node.metadata.x > largestX) {
						largestX = node.metadata.x;
					}
					if (!largestY || node.metadata.y > largestY) {
						largestY = node.metadata.y;
					}
				});

				// https://www.mathsisfun.com/pythagoras.html
				// https://www.varsitytutors.com/hotmath/hotmath_help/topics/magnitude-and-direction-of-vectors

				const magnitude = Math.sqrt(largestX ** 2 + largestY ** 2);

				// scale everything to fit dimensions of view
				nodes.forEach((node) => {
					if (
						typeof node.metadata.latitude === 'number' ||
						typeof node.metadata.longitude === 'number'
					) {
						node.metadata.x =
							(node.metadata.x / magnitude) * options.width + options.offset;
						node.metadata.y =
							(node.metadata.y / magnitude) * options.height + options.offset;
					}
				});

				resolve({
					nodes,
					edges: data.graph.edges
				});
			})
			.catch((e) => {
				reject(e);
			});
	});
}



convertLatLongToXY(
	'wirepas.json', {
		width: 800,
		height: 800,
		offset: 150
	}
).then((data) => {
	const svg = d3
		.select('body')
		.append('svg')
		.attr('width', '1000px')
		.attr('height', '1000px');

	// draw lines between nodes with D3
	svg
		.selectAll('line')
		.data(data.edges, function (d) {

		})
		.enter()
		.append('line')
		.attr('class', 'pointer')
		.attr('x1', function (d) {


			return d.source.metadata.x;

		})
		.attr('y1', function (d) {


			return d.source.metadata.y;

		})
		.attr('x2', function (d) {

			return d.target.metadata.x;


		})
		.attr('y2', function (d) {

			return d.target.metadata.y;

		})
		.attr('stroke-width', 3)
		.attr('stroke', 'grey');

	// draw nodes as circle shapes with D3
	svg
		.selectAll('.circle')
		.data(data.nodes)
		.enter()
		.append('circle')
		.attr('class', 'pointer')
		.attr('cx', function (d) {
			return d.metadata.x;
		})
		.attr('cy', function (d) {

			return d.metadata.y;
		})
		.attr('r', 4.5)
		.attr('fill', function (d) {
			if (d.metadata.status === 'ONLINE') {
				return '#0f0';
			} else {
				return '#f00';
			}
		})
		.append('svg:title')
		.text(function (d) {
			return `nodeId: ${d.metadata.id}
			 \n description: ${d.metadata.description}
			 \n status: ${d.metadata.status}
			 \n voltage: ${d.metadata.voltage}
			 \n last_update: ${moment(d.metadata.last_update)}
			 \n network_id: ${d.metadata.network_id}
			 \n positioning_role: ${d.metadata.positioning_role}
			 \n latitude: ${d.metadata.latitude}
			 \n longitude: ${d.metadata.longitude}
			 `;
		});

	// animate circles when moused over

	d3.selectAll('circle')
		.on('mouseover', function (d) {

			d3.select(this).attr('r', 10);
		})
		.on('mouseout', function (d) {

			d3.select(this).attr('r', 4.5);
		});

	var tooltip = d3
		.select('body')
		.append('div')
		.style('background', 'white')
		.style('border', '1px solid black')
		.style('padding', '4px')
		.style('position', 'absolute')
		.style('z-index', '10')
		.style('visibility', 'visible');

	// highlight network connection as red when moused over and display signal strength tooltip

	d3.selectAll('line')
		.on('mouseover', function (d) {

			d3.select(this).attr('stroke', 'red');
			tooltip
				.style('visibility', 'visible')
				.text(`Signal Quality: ${d.metadata.quality.toFixed(2)}`);
			tooltip.style('top', `${d.source.metadata.y}px`);
			tooltip.style('left', `${d.source.metadata.x}px`);
		})
		.on('mouseout', function () {
			d3.select(this).attr('stroke', 'grey');
			return tooltip.style('visibility', 'hidden');
		});
});