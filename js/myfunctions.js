document.addEventListener('DOMContentLoaded', () => {

    // Define the API key for accessing NASA's Mars Rover data
    const apiKey = 'ecrzB3mDqRePjDwqw2EWP5ATqWKqIInu6c4xMbOm';

    // Get references to the DOM elements for user interactions
    const dateInput = document.getElementById('dateInput');// Input field for selecting date
    const fetchBtn = document.getElementById('fetchBtn');// Button to fetch photos
    const imageContainer = document.getElementById('imageContainer');// Container to display the images
    const spinner = document.getElementById('spinner');// Spinner to show loading status
    const fullscreenSpinner = document.getElementById('fullscreenSpinner');// Spinner for fullscreen loading
    const listContainer = document.getElementById('listContainer'); // Container for displaying photo list
    // Button to go back to search from list view
    const backToSearchFromListBtn = document.getElementById('backToSearchFromListBtn');
    const carouselItems = document.getElementById('carouselItems');// Container for carousel items (for photo slideshow)
    const backToListBtn = document.getElementById('backToListBtn');// Button to go back to list view
    const backToPhotosBtn = document.getElementById('backToPhotosBtn');// Button to go back to photos view
    const listPhotos = [];// Array to store the list of photos added by the user
    const resetBtn = document.getElementById('resetBtn');// Button to reset the inputs and filters

    // Define an object to store rover information for different rovers
    let roverData = {}; // Holds rover data (e.g., min/max date range) for filtering photos by date

    /**
     * Displays the fullscreen spinner by updating its CSS styles.
     * It sets the spinner's display to 'flex', visibility to 'visible', and opacity to '1',
     * making it appear on the screen.
     */
    function showFullscreenSpinner() {
        fullscreenSpinner.style.display = 'flex';
        fullscreenSpinner.style.visibility = 'visible';
        fullscreenSpinner.style.opacity = '1';
    }

    /**
     * Hides the fullscreen spinner by updating its CSS styles.
     * It sets the spinner's display to 'none', visibility to 'hidden', and opacity to '0',
     * making it disappear from the screen.
     */
    function hideFullscreenSpinner() {
        fullscreenSpinner.style.display = 'none';
        fullscreenSpinner.style.visibility = 'hidden';
        fullscreenSpinner.style.opacity = '0';
    }

    /**
     * Displays the spinner by setting its CSS display property to 'block'.
     * This makes the spinner element visible on the screen.
     */
    function showSpinner() {
        spinner.style.display = 'block';
    }
    /**
     * Hides the spinner by setting its CSS display property to 'none'.
     * This makes the spinner element invisible on the screen.
     */
    function hideSpinner() {
        spinner.style.display = 'none';
    }

    /**
     * Fetches information about Mars rovers from the NASA API.
     * If the rover data is already stored in the sessionStorage, it retrieves it to avoid repeated API calls.
     * Otherwise, it makes a network request to the NASA API, processes the response,
     * and stores the rover information in sessionStorage for future use.
     *
     * @async
     * @throws {Error} Throws an error if the API call fails or the response is not successful.
     */
    async function fetchRoverInformation() {
        // NASA API endpoint for fetching rover information

        const endpoint = `https://api.nasa.gov/mars-photos/api/v1/rovers?api_key=${apiKey}`;
        // Check if rover data is already stored in sessionStorage
        const storedRoverData = sessionStorage.getItem('roverData');
        if (storedRoverData) {
            roverData = JSON.parse(storedRoverData);
            return;
        }

        try {
            // Make a request to the NASA API
            const response = await fetch(endpoint);
            // Check if the response is successful
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            // Parse the response JSON
            const data = await response.json();

            // Process and store rover information
            roverData = {};
            data.rovers.forEach(rover => {
                roverData[rover.name.toLowerCase()] = {
                    minDate: rover.landing_date,
                    maxDate: rover.max_date,
                };
            });

            // Store processed rover data in sessionStorage
            sessionStorage.setItem('roverData', JSON.stringify(roverData));
        } catch (error) {
            throw new Error(`Failed to fetch rover information. ${error.message}`);
        }
    }

    /**
     * Fetches photos for a specific date from the Mars rover data.
     * It validates the date against the range of available dates for the rovers and tries to fetch photos.
     * If no photos are found for the exact date, it attempts to find photos for a nearby date.
     *
     * @async
     * @param {string} date - The selected date for which to fetch photos (in YYYY-MM-DD format).
     * @returns {Array} An array of photos for the selected or closest date, or an empty array if no photos are found.
     */
    async function fetchPhotosForDate(date) {
        const selectedRover = document.getElementById('roverFilter').value;
        const selectedCamera = document.getElementById('cameraFilter').value;

        // Validate the date against the available date range for all rovers
        const validRovers = Object.keys(roverData).filter(rover => {
            const roverRange = roverData[rover];
            return new Date(date) >= new Date(roverRange.minDate) && new Date(date) <= new Date(roverRange.maxDate);
        });

        // If no rovers have valid data for the selected date
        if (validRovers.length === 0) {
            // No rovers have valid data for the selected date
            const minDate = Math.min(...Object.values(roverData).map(range => new Date(range.minDate).getTime()));
            const maxDate = Math.max(...Object.values(roverData).map(range => new Date(range.maxDate).getTime()));
            const minDateFormatted = new Date(minDate).toLocaleDateString();
            const maxDateFormatted = new Date(maxDate).toLocaleDateString();
            alert(`No photos available before ${minDateFormatted} or after ${maxDateFormatted}`);
            return [];
        }

        // Try fetching photos for the selected date
        const photos = await tryFetchingPhotosForDate(date, validRovers, selectedRover, selectedCamera);
        if (photos.length === 0) {
            // If no photos are found, try searching for the closest date (+/- 1 day, +/- 2 days, etc.)
            let closestDate = await findClosestDate(date, validRovers);
            if (closestDate) {
                alert(`No photos found for this date, but we found photos on ${closestDate}`);
                dateInput.value = closestDate;  // Update the date input
                // Fetch photos for the closest date
                return await tryFetchingPhotosForDate(closestDate, validRovers, selectedRover, selectedCamera);
            } else {
                alert('No photos available for this date or nearby dates.');
            }
        }

        return photos;
    }

    /**
     * Attempts to fetch photos for a specific date from the valid rovers.
     * Filters the fetched photos based on the selected rover and camera, if provided.
     *
     * @async
     * @param {string} date - The selected date for which to fetch photos (in YYYY-MM-DD format).
     * @param {Array<string>} validRovers - An array of rover names with valid data for the given date.
     * @param {string} selectedRover - The name of the selected rover (optional).
     * @param {string} selectedCamera - The name of the selected camera (optional).
     * @returns {Array} An array of photos matching the date and selected filters.
     * @throws {Error} Throws an error if any API request fails or if fetching photos is unsuccessful.
     */
    async function tryFetchingPhotosForDate(date, validRovers, selectedRover,
                                            selectedCamera) {

        // Create API requests for all valid rovers
        const requests = validRovers.map(rover =>
            fetch(`https://api.nasa.gov/mars-photos/api/v1/rovers/${rover}/photos?earth_date=${date}&api_key=${apiKey}`)
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
        );

        try {
            // Execute all requests concurrently
            const results = await Promise.all(requests);

            // Extract and combine photos from all results
            const photos = results.flatMap(result => result.photos);

            // Filter photos based on the selected rover and camera
            const filteredPhotos = photos.filter(photo => {
                const matchesRover = selectedRover ? photo.rover.name.toLowerCase() ===
                    selectedRover.toLowerCase() : true;
                const matchesCamera = selectedCamera ? photo.camera.full_name.toLowerCase().includes
                (selectedCamera.toLowerCase()) : true;
                return matchesRover && matchesCamera;
            });

            return filteredPhotos;
        } catch (error) {
            throw new Error(`Failed to fetch photos: ${error.message}`);
        }
    }

    /**
     * Finds the closest available date with photos by searching forward and backward
     * from the given date within a specified range (up to 5 days).
     *
     * @async
     * @param {string} date - The selected date (in YYYY-MM-DD format) for which to find the closest photos.
     * @param {Array<string>} validRovers - An array of rover names with valid data for the given date.
     * @returns {string|null} The closest available date with photos (in YYYY-MM-DD format), or null if none are found.
     */
    async function findClosestDate(date, validRovers) {
        let closestDate = null;// Stores the closest available date
        let closestDiff = Infinity;// Stores the smallest difference in days

        // Search for dates +/- 1 day, +/- 2 days, etc., up to 5 days
        for (let delta = 1; delta <= 5; delta++) {
            const forwardDate = new Date(date);
            const backwardDate = new Date(date);
            forwardDate.setDate(forwardDate.getDate() + delta);
            backwardDate.setDate(backwardDate.getDate() - delta);

            // Format the dates to YYYY-MM-DD
            const forwardDateString = forwardDate.toISOString().split('T')[0]; // Format to YYYY-MM-DD
            const backwardDateString = backwardDate.toISOString().split('T')[0]; // Format to YYYY-MM-DD

            // Fetch photos for the forward and backward dates
            const forwardPhotos = await tryFetchingPhotosForDate(forwardDateString, validRovers);
            const backwardPhotos = await tryFetchingPhotosForDate(backwardDateString, validRovers);

            // Check if photos are found for the forward date
            if (forwardPhotos.length > 0 && delta < closestDiff) {
                closestDate = forwardDateString;
                closestDiff = delta;
            }
            // Check if photos are found for the backward date
            else if (backwardPhotos.length > 0 && delta < closestDiff) {
                closestDate = backwardDateString;
                closestDiff = delta;
            }

            if (closestDate) break; // If a closest date is found, stop searching further
        }

        return closestDate;
    }

    /**
     * Displays a list of photos in the image container.
     * If no photos are found, displays a warning message.
     * Filters the photos before displaying and updates the filter options.
     *
     * @param {Array} photos - An array of photo objects to display.
     */
    function displayImages(photos) {
        // Clear the current content of the image container
        imageContainer.innerHTML = '';

        // If no photos are provided, display a warning message and return
        if (photos.length === 0) {
            imageContainer.innerHTML = `<p class="text-warning">No photos found for the selected date.</p>`;
            return;
        }

        // Apply filters before displaying the images
        const filteredPhotos = filterPhotos(photos);
        updateFilters(filteredPhotos);

        // Iterate through the filtered photos to create and display cards
        filteredPhotos.forEach(photo => {
            const col = document.createElement('div');
            col.className = 'col-lg-6 col-xl-4 mb-4';
            col.innerHTML = ` 
            <div class="card shadow-lg h-100">
                <img src="${photo.img_src}" class="card-img-top" alt="Mars Rover Image">
                <div class="card-body">
                    <h4 class="card-title">Rover: ${photo.rover.name}</h4>
                    <p class="card-text"><strong>Camera:</strong> ${photo.camera.full_name}</p>
                    <p class="card-text"><strong>Date:</strong> ${photo.earth_date}</p>
                    <button class="btn btn-primary fullscreen-btn">View Fullscreen</button>
                    <button class="btn btn-success add-to-list-btn">Add to List</button>
                </div>
            </div>
        `;

            // Add an event listener to the "View Fullscreen" button
            const fullscreenButton = col.querySelector('.fullscreen-btn');
            fullscreenButton.addEventListener('click', () => col.querySelector
            ('.card-img-top').requestFullscreen());

            // Add an event listener to the "Add to List" button
            const addButton = col.querySelector('.add-to-list-btn');
            addButton.addEventListener('click', () => addPhotoToList(photo));

            // Append the column to the image container
            imageContainer.appendChild(col);
        });
    }

    /**
     * Adds a photo to the list of photos if it's not already present.
     * If the photo is added, it updates the list container and generates the carousel.
     *
     * @param {Object} photo - The photo object to be added to the list.
     */
    function addPhotoToList(photo) {
        // Check if the photo is already in the list
        if (listPhotos.some(p => p.id === photo.id)) {
            alert('This photo is already in your list.');
            return;
        }
        photo.description = ""; // Add a blank description field
        listPhotos.push(photo);    // Add the photo to the list
        updateListContainer();
        generateCarousel(); // Update the story tab immediately
        alert('Photo added to the list!');
    }

    /**
     * Updates the list container to display the photos in the user's list.
     * If the list is empty, a message is shown and the "Navigate to Story" button is disabled.
     * If the list contains photos, it generates a grid of cards with photo details and description fields.
     *
     * @returns {void}
     */
    function updateListContainer() {
        listContainer.innerHTML = '';
        // If no photos are in the list, display a message and disable the "Navigate to Story" button
        if (listPhotos.length === 0) {
            listContainer.innerHTML =
                '<p class="fs-4 text-center">Your list is empty. Add some photos and they will appear here.</p>';
            // Disable the "Navigate to Story" button
            document.getElementById('navigateToStoryBtn').disabled = true;
            document.getElementById('navigateToStoryBtnWrapper').innerHTML =
                '<p class="fs-4 text-center">Add some photos to create a story.</p>';
            return;
        }

        // Create a row element to hold the photo cards
        const row = document.createElement('div');
        row.className = 'row gy-4';

        // Iterate through the photos in the list and create a card for each
        listPhotos.forEach(photo => {
            const col = document.createElement('div');
            col.className = 'col-lg-6 col-xl-4 mb-4';
            col.innerHTML = `
            <div class="card shadow-lg h-100">
                <img src="${photo.img_src}" class="card-img-top" alt="Mars Rover Image">
                <div class="card-body">
                    <h4 class="card-title">Rover: ${photo.rover.name}</h4>
                    <p class="card-text"><strong>Camera:</strong> ${photo.camera.full_name}</p>
                    <p class="card-text"><strong>Date:</strong> ${photo.earth_date}</p>
                    <textarea class="form-control mb-3 photo-description" placeholder="Write a description...">
                                    ${photo.description}</textarea>
                    <button class="btn btn-danger remove-from-list-btn">Remove</button>
                </div>
            </div>
        `;

            // Add event listener to the description textarea to update the photo's description
            const descriptionField = col.querySelector('.photo-description');
            descriptionField.addEventListener('input', (event) => {
                photo.description = event.target.value; // Update description
                generateCarousel(); // Update the carousel immediately to reflect changes

            });

            // Add event listener to the remove button to remove the photo from the list
            const removeButton = col.querySelector('.remove-from-list-btn');
            removeButton.addEventListener('click', () => removePhotoFromList(photo.id));

            // Append the column to the row
            row.appendChild(col);
        });
        listContainer.appendChild(row);

        // Enable the "Navigate to Story" button when there is at least one photo
        document.getElementById('navigateToStoryBtn').disabled = false;
        document.getElementById('navigateToStoryBtnWrapper').innerHTML = `
        <button id="navigateToStoryBtn" class="btn btn-lg btn-primary px-4 py-3">Navigate to Story</button>
    `;
    }

    /**
     * Removes a photo from the user's list based on its unique photo ID.
     * After removal, it updates the list container and regenerates the carousel.
     *
     * @param {string} photoId - The ID of the photo to be removed from the list.
     */
    function removePhotoFromList(photoId) {
        // Find the index of the photo in the list based on the photo's ID
        const index = listPhotos.findIndex(photo => photo.id === photoId);
        if (index !== -1) {    // If the photo is found in the list (index is not -1)
            listPhotos.splice(index, 1);
            updateListContainer();
            generateCarousel(); // Update the story tab immediately
        }
    }

    /**
     * Generates and displays a carousel of photos based on the current list of photos.
     * If the list is empty, it shows a message prompting the user to add photos to the list.
     */
    function generateCarousel() {
        carouselItems.innerHTML = '';
        if (listPhotos.length === 0) {
            carouselItems.innerHTML = `<div class="carousel-item active">
                <div class="text-center">
                    <p class="fs-4">Your list is empty. Add some photos to view the story.</p>
                </div>
            </div>`;
            return;
        }
        // Iterate through each photo in the list and create a carousel item for each
        listPhotos.forEach((photo, index) => {
            const carouselItem = document.createElement('div');
            carouselItem.className = `carousel-item ${index === 0 ? 'active' : ''}`;
            carouselItem.innerHTML = `
                <div class="d-flex flex-column align-items-center">
                    <p class="fs-4">${photo.description || 'No description provided.'}</p>
                    <img src="${photo.img_src}" class="d-block w-75" alt="Mars Rover Image">
                </div>
            `;
            carouselItems.appendChild(carouselItem);
        });
    }

    // Back buttons    const photosTab = new bootstrap.Tab(document.querySelector('#photos-tab'));
    backToListBtn.addEventListener('click', () => {
        const listTab = new bootstrap.Tab(document.querySelector('#list-tab'));
        listTab.show();
    });

    backToPhotosBtn.addEventListener('click', () => {
        const photosTab = new bootstrap.Tab(document.querySelector('#photos-tab'));
        photosTab.show();
    });

    // Event listener for fetching photos
    fetchBtn.addEventListener('click', async () => {
        const date = dateInput.value;
        if (!date) {
            alert('Please select a valid date.');
            return;
        }
        // Show the spinner while fetching data
        showSpinner();
        try {
            // Fetch photos for the selected date
            const photos = await fetchPhotosForDate(date);
            displayImages(photos);
        } catch (error) {
            alert(`An error occurred: ${error.message}`);
        } finally {
            hideSpinner();
        }
    });

    /**
     * Initializes the application by fetching rover information and displaying a fullscreen spinner while the data is being fetched.
     * If an error occurs during the fetching process, an alert with the error message is shown.
     *
     * @returns {void}
     */
    async function initializeApp() {
        showFullscreenSpinner();
        try {
            await fetchRoverInformation();
        } catch (error) {
            alert(error.message);
        } finally {
            hideFullscreenSpinner();
        }
    }

    initializeApp(); // Start the app
});

// Event listener for the "Back to List" button to navigate to the "List" tab
backToListBtn.addEventListener('click', () => {
    // Get the "List" tab and activate it
    const listTab = new bootstrap.Tab(document.querySelector('#list-tab'));
    listTab.show();
});

// Event listener for the "Back to Photos" button to navigate to the "Photos" tab
backToPhotosBtn.addEventListener('click', () => {
    const photosTab = new bootstrap.Tab(document.querySelector('#photos-tab'));
    photosTab.show();
});

// Event listener for the "Back to Search from List" button to navigate back to the "Photos" tab
backToSearchFromListBtn.addEventListener('click', () => {
    // Get the "Photos" tab and activate it
    const photosTab = new bootstrap.Tab(document.querySelector('#photos-tab'));
    photosTab.show(); // Activate the "Photos" tab
});

/**
 * Updates the filter options (rover and camera) based on the provided photos.
 * Enables the filter dropdowns only if the "Photos" tab is active and there are photos to filter.
 * Populates the rover and camera dropdowns with unique options based on the photos.
 *
 * @param {Array} photos - The array of photos to extract filter options from.
 * @returns {void}
 */
function updateFilters(photos) {
    const roverSelect = document.getElementById('roverFilter');
    const cameraSelect = document.getElementById('cameraFilter');

    // Enable the filters only if we are in the "Photos" tab and photos exist
    if (photos.length > 0) {
        roverSelect.disabled = false;
        cameraSelect.disabled = false;

        // Populate rover filter dropdown dynamically
        const rovers = [...new Set(photos.map(photo => photo.rover.name))]; // Get unique rover names
        roverSelect.innerHTML = '<option value="">Select Rover</option>';
        rovers.forEach(rover => {
            roverSelect.innerHTML += `<option value="${rover}">${rover}</option>`;
        });

        // Populate camera filter dropdown dynamically
        const cameras = [...new Set(photos.map(photo => photo.camera.full_name))]; // Get unique camera names
        cameraSelect.innerHTML = '<option value="">Select Camera</option>';
        cameras.forEach(camera => {
            cameraSelect.innerHTML += `<option value="${camera}">${camera}</option>`;
        });
    } else {
        roverSelect.disabled = true;
        cameraSelect.disabled = true;
    }
}

/**
 * Filters the provided photos based on selected rover and camera filters.
 *
 * @param {Array} photos - The array of photos to filter.
 * @returns {Array} The filtered array of photos based on the selected filters.
 */
function filterPhotos(photos) {
    const roverFilter = document.getElementById('roverFilter').value;
    const cameraFilter = document.getElementById('cameraFilter').value;

    let filteredPhotos = photos;

    // Filter by rover
    if (roverFilter) {
        filteredPhotos = filteredPhotos.filter(photo => photo.rover.name === roverFilter);
    }

    // Filter by camera
    if (cameraFilter) {
        filteredPhotos = filteredPhotos.filter(photo => photo.camera.full_name === cameraFilter);
    }

    return filteredPhotos;
}

// Event listener for navigating to the story tab
document.getElementById('navigateToStoryBtn').addEventListener('click', () => {
    const storyTab = new bootstrap.Tab(document.querySelector('#story-tab'));
    storyTab.show();
});

/**
 * Event listener for the reset button to clear the selected date and reset the filters.
 * It clears the date input, disables the filters, and optionally clears any displayed photos.
 */
resetBtn.addEventListener('click', () => {
    // Clear the date input field
    dateInput.value = '';

    // Hide the filters
    document.getElementById('roverFilter').disabled = true;
    document.getElementById('cameraFilter').disabled = true;

    // Optionally clear any displayed photos
    imageContainer.innerHTML = '<p class="fs-4">Select a date and click "Fetch Images" to see results.</p>';

    // Hide filters dropdown
    document.getElementById('roverFilter').selectedIndex = 0;
    document.getElementById('cameraFilter').selectedIndex = 0;
});
