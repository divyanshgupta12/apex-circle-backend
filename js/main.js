/* ============================================
   The Apex Circle - Main JavaScript
   Navigation & Shared Utilities
   ============================================ */

// Mobile menu toggle
function initMobileMenu() {
    const toggle = document.querySelector('.mobile-menu-toggle');
    const menu = document.querySelector('.nav-menu');
    
    if (toggle && menu) {
        toggle.addEventListener('click', function() {
            menu.classList.toggle('active');
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', function(event) {
            if (!toggle.contains(event.target) && !menu.contains(event.target)) {
                menu.classList.remove('active');
            }
        });
    }
}

// Set active navigation link
function setActiveNavLink() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navLinks = document.querySelectorAll('.nav-menu a');
    
    navLinks.forEach(link => {
        const linkPath = link.getAttribute('href');
        if (linkPath === currentPage || 
            (currentPage === '' && linkPath === 'index.html') ||
            (currentPage === 'index.html' && linkPath === 'index.html')) {
            link.classList.add('active');
        }
    });
}

// Smooth scroll for anchor links
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            const href = this.getAttribute('href');
            if (href !== '#' && href.length > 1) {
                e.preventDefault();
                const target = document.getElementById(href.substring(1));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            }
        });
    });
}

// Form validation
function validateForm(form) {
    const inputs = form.querySelectorAll('input[required], textarea[required], select[required]');
    let isValid = true;
    
    inputs.forEach(input => {
        if (!input.value.trim()) {
            isValid = false;
            input.classList.add('error');
        } else {
            input.classList.remove('error');
        }
    });
    
    // Email validation
    const emailInputs = form.querySelectorAll('input[type="email"]');
    emailInputs.forEach(input => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (input.value && !emailRegex.test(input.value)) {
            isValid = false;
            input.classList.add('error');
        }
    });
    
    return isValid;
}

// Handle contact form submission
function handleContactForm(event) {
    event.preventDefault();
    
    const form = event.target;
    
    if (validateForm(form)) {
        // Simulate form submission
        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;
        submitBtn.textContent = 'Sending...';
        submitBtn.disabled = true;
        
        setTimeout(() => {
            alert('Thank you for your message! We will get back to you soon.');
            form.reset();
            submitBtn.textContent = originalText;
            submitBtn.disabled = false;
        }, 1500);
    } else {
        alert('Please fill in all required fields correctly.');
    }
}

// Handle collaboration form submission
function handleCollaborationForm(event) {
    event.preventDefault();
    
    const form = event.target;
    
    if (validateForm(form)) {
        const companyName = form.querySelector('#companyName').value;
        const website = form.querySelector('#website').value;
        const contactPerson = form.querySelector('#contactPerson').value;
        const position = form.querySelector('#position').value;
        const email = form.querySelector('#email').value;
        const phone = form.querySelector('#phone').value;
        const collabType = form.querySelector('#collabType').value;
        const message = form.querySelector('#message').value;
        
        const subject = `Partnership Inquiry: ${companyName}`;
        const body = `
New Partnership Inquiry

Company: ${companyName}
Website: ${website}

Contact Person: ${contactPerson}
Position: ${position}
Email: ${email}
Phone: ${phone}

Collaboration Type: ${collabType}

Message:
${message}
        `.trim();
        
        const mailtoLink = `mailto:theapexcirclestarexuniversity@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
        
        // Open mailto link
        window.location.href = mailtoLink;
        
        // Show success message
        alert('Opening your email client to send the proposal...');
        form.reset();
    } else {
        alert('Please fill in all required fields correctly.');
    }
}

// Format currency
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

// Format date
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}

// Format number with commas
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Image Lightbox Gallery
function initImageLightbox() {
    const lightbox = document.getElementById('imageLightbox');
    const lightboxImage = lightbox ? lightbox.querySelector('.lightbox-image') : null;
    const lightboxCaption = lightbox ? lightbox.querySelector('.lightbox-caption') : null;
    const lightboxClose = lightbox ? lightbox.querySelector('.lightbox-close') : null;
    const lightboxOverlay = lightbox ? lightbox.querySelector('.lightbox-overlay') : null;
    const lightboxPrev = lightbox ? lightbox.querySelector('.lightbox-prev') : null;
    const lightboxNext = lightbox ? lightbox.querySelector('.lightbox-next') : null;
    const clickableImages = document.querySelectorAll('.gallery-item.clickable-image');
    
    if (!lightbox || !lightboxImage || !lightboxCaption) return;
    
    let currentImages = [];
    let currentIndex = 0;
    
    // Collect all images from the current event section
    function collectImages() {
        currentImages = Array.from(clickableImages).map(item => ({
            src: item.getAttribute('data-image'),
            alt: item.getAttribute('data-alt') || ''
        }));
    }
    
    // Open lightbox with specific image
    function openLightbox(index) {
        collectImages();
        if (currentImages.length === 0) return;
        
        currentIndex = index;
        updateLightboxImage();
        lightbox.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
    
    // Update lightbox image and caption
    function updateLightboxImage() {
        if (currentImages.length === 0) return;
        const image = currentImages[currentIndex];
        lightboxImage.src = image.src;
        lightboxImage.alt = image.alt;
        lightboxCaption.textContent = image.alt;
        
        // Show/hide navigation buttons
        if (lightboxPrev) lightboxPrev.style.display = currentImages.length > 1 ? 'flex' : 'none';
        if (lightboxNext) lightboxNext.style.display = currentImages.length > 1 ? 'flex' : 'none';
    }
    
    // Close lightbox
    function closeLightbox() {
        lightbox.style.display = 'none';
        document.body.style.overflow = '';
    }
    
    // Navigate to next image
    function nextImage() {
        if (currentImages.length === 0) return;
        currentIndex = (currentIndex + 1) % currentImages.length;
        updateLightboxImage();
    }
    
    // Navigate to previous image
    function prevImage() {
        if (currentImages.length === 0) return;
        currentIndex = (currentIndex - 1 + currentImages.length) % currentImages.length;
        updateLightboxImage();
    }
    
    // Add click handlers to gallery items
    clickableImages.forEach((item, index) => {
        item.addEventListener('click', () => openLightbox(index));
    });
    
    // Close handlers
    if (lightboxClose) {
        lightboxClose.addEventListener('click', closeLightbox);
    }
    if (lightboxOverlay) {
        lightboxOverlay.addEventListener('click', closeLightbox);
    }
    
    // Navigation handlers
    if (lightboxNext) {
        lightboxNext.addEventListener('click', (e) => {
            e.stopPropagation();
            nextImage();
        });
    }
    if (lightboxPrev) {
        lightboxPrev.addEventListener('click', (e) => {
            e.stopPropagation();
            prevImage();
        });
    }
    
    // Keyboard navigation
    document.addEventListener('keydown', function(e) {
        if (lightbox.style.display === 'none') return;
        
        if (e.key === 'Escape') {
            closeLightbox();
        } else if (e.key === 'ArrowRight') {
            nextImage();
        } else if (e.key === 'ArrowLeft') {
            prevImage();
        }
    });
    
    // Prevent lightbox content from closing when clicking on image
    if (lightboxImage) {
        lightboxImage.addEventListener('click', (e) => e.stopPropagation());
    }
}

// Events Slider
function initEventsSlider() {
    const track = document.querySelector('.events-track');
    if (!track) return;
    
    const slides = Array.from(track.children);
    const nextButton = document.querySelector('.events-slider-container .next-btn');
    const prevButton = document.querySelector('.events-slider-container .prev-btn');
    const dotsNav = document.querySelector('.slider-nav');
    const dots = Array.from(dotsNav.children);
    const container = document.querySelector('.events-slider-container');
    
    let currentSlideIndex = 0;
    let slideInterval;
    let isVideoPlaying = false;
    
    const updateSlidePosition = (index) => {
        track.style.transform = 'translateX(-' + (index * 100) + '%)';
        
        // Update dots
        dots.forEach(dot => dot.classList.remove('active'));
        if (dots[index]) {
            dots[index].classList.add('active');
        }
        
        currentSlideIndex = index;

        // Pause video in previous slide if any
        slides.forEach((slide, i) => {
            if (i !== index) {
                const video = slide.querySelector('video');
                if (video) {
                    video.pause();
                    video.currentTime = 0;
                }
            }
        });
    };
    
    // Start Auto Play
    const startSlideShow = () => {
        stopSlideShow();
        slideInterval = setInterval(() => {
            const nextIndex = (currentSlideIndex + 1) % slides.length;
            updateSlidePosition(nextIndex);
        }, 5000);
    };

    // Stop Auto Play
    const stopSlideShow = () => {
        clearInterval(slideInterval);
    };

    // Click events
    if (nextButton) {
        nextButton.addEventListener('click', () => {
            const nextIndex = (currentSlideIndex + 1) % slides.length;
            updateSlidePosition(nextIndex);
            stopSlideShow();
            if (!isVideoPlaying) startSlideShow();
        });
    }
    
    if (prevButton) {
        prevButton.addEventListener('click', () => {
            const prevIndex = (currentSlideIndex - 1 + slides.length) % slides.length;
            updateSlidePosition(prevIndex);
            stopSlideShow();
            if (!isVideoPlaying) startSlideShow();
        });
    }
    
    // Dot navigation
    dots.forEach((dot, index) => {
        dot.addEventListener('click', () => {
            updateSlidePosition(index);
            stopSlideShow();
            if (!isVideoPlaying) startSlideShow();
        });
    });
    
    // Initial start
    startSlideShow();
    
    // Pause on hover
    if (container) {
        container.addEventListener('mouseenter', () => {
            stopSlideShow();
        });
        
        container.addEventListener('mouseleave', () => {
            if (!isVideoPlaying) {
                startSlideShow();
            }
        });

        // Handle video elements within the slider
        const videos = container.querySelectorAll('video');
        videos.forEach(video => {
            video.addEventListener('play', () => {
                isVideoPlaying = true;
                stopSlideShow();
            });
            
            video.addEventListener('pause', () => {
                isVideoPlaying = false;
                if (!container.matches(':hover')) {
                    startSlideShow();
                }
            });
            
            video.addEventListener('ended', () => {
                isVideoPlaying = false;
                if (!container.matches(':hover')) {
                    startSlideShow();
                }
            });
        });
    }

    // Initialize first dot as active
    if (dots.length > 0) {
        dots[0].classList.add('active');
    }
}

// Header Scroll Effect
function initHeaderScroll() {
    const header = document.querySelector('.header');
    
    if (header) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 50) {
                header.classList.add('scrolled');
            } else {
                header.classList.remove('scrolled');
            }
        });
        
        // Initial check
        if (window.scrollY > 50) {
            header.classList.add('scrolled');
        }
    }
}

// Scroll Animations
function initScrollAnimations() {
    // 1. Auto-tag common elements with animation classes if they don't have them
    const animationRules = [
        { selector: '.hero h1', class: 'fade-in-up', delay: '' },
        { selector: '.hero p', class: 'fade-in-up', delay: 'delay-200' },
        { selector: '.hero-cta', class: 'fade-in-up', delay: 'delay-300' },
        { selector: '.section-title', class: 'fade-in-up', delay: '' },
        { selector: '.section h2', class: 'fade-in-up', delay: '' }, // Catch-all for headings
        { selector: '.feature-card', class: 'fade-in-up', stagger: true },
        { selector: '.service-card', class: 'fade-in-up', stagger: true },
        { selector: '.process-step', class: 'fade-in-right', stagger: true },
        { selector: '.team-member', class: 'fade-in-up', stagger: true },
        { selector: '.gallery-item', class: 'zoom-in', stagger: true },
        { selector: '.contact-info', class: 'fade-in-left', delay: '' },
        { selector: '.contact-form', class: 'fade-in-right', delay: '' },
        { selector: '.about-content', class: 'fade-in-up', delay: '' },
        { selector: '.about-image', class: 'fade-in-left', delay: '' },
        { selector: '.collaboration-banner', class: 'zoom-in', delay: '' }
    ];

    animationRules.forEach(rule => {
        const elements = document.querySelectorAll(rule.selector);
        elements.forEach((el, index) => {
            if (!el.classList.contains('animate-on-scroll')) {
                el.classList.add('animate-on-scroll');
                el.classList.add(rule.class);
                
                if (rule.delay) {
                    el.classList.add(rule.delay);
                }
                
                if (rule.stagger) {
                    // Stagger delay based on index (modulo 5 to restart cycle)
                    const staggerDelay = (index % 5) + 1; // 1 to 5
                    el.classList.add(`delay-${staggerDelay}00`);
                }
            }
        });
    });

    // 2. Set up Intersection Observer
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.15 // Trigger when 15% of element is visible
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target); // Only animate once
            }
        });
    }, observerOptions);

    // 3. Observe all elements with .animate-on-scroll or .reveal
    document.querySelectorAll('.animate-on-scroll, .reveal').forEach(el => {
        observer.observe(el);
    });
}

// Background Music Control
function initMusicControl() {
    const bgMusic = document.getElementById('bgMusic');
    
    if (!bgMusic) return;

    // Set initial volume
    bgMusic.volume = 0.5;

    // Try to play immediately
    const playPromise = bgMusic.play();

    if (playPromise !== undefined) {
        playPromise.catch(error => {
            console.log("Autoplay prevented by browser. Waiting for user interaction.");
            // Add a one-time listener to start music on first interaction
            const startMusic = () => {
                bgMusic.play().catch(e => console.log("Still prevented:", e));
                document.removeEventListener('click', startMusic);
                document.removeEventListener('keydown', startMusic);
                document.removeEventListener('touchstart', startMusic);
            };

            document.addEventListener('click', startMusic);
            document.addEventListener('keydown', startMusic);
            document.addEventListener('touchstart', startMusic);
        });
    }

    // Video Sync Logic
    const videos = document.querySelectorAll('video');
    videos.forEach(video => {
        // When video plays
        video.addEventListener('play', () => {
            // Only pause music if video is NOT muted
            if (!video.muted) {
                bgMusic.pause();
            }
        });

        // When video pauses or ends
        video.addEventListener('pause', () => {
            bgMusic.play().catch(e => console.log("Resume bg music failed:", e));
        });
        
        video.addEventListener('ended', () => {
            bgMusic.play().catch(e => console.log("Resume bg music failed:", e));
        });

        // When volume changes (mute/unmute)
        video.addEventListener('volumechange', () => {
            if (video.muted || video.paused) {
                // If video is muted or paused, resume background music
                bgMusic.play().catch(e => console.log("Resume bg music failed:", e));
            } else {
                // If video is playing AND unmuted, pause background music
                bgMusic.pause();
            }
        });
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    initMobileMenu();
    setActiveNavLink();
    initHeaderScroll(); // Initialize Header Scroll Effect
    initSmoothScroll();
    initImageLightbox();
    initEventsSlider(); // Initialize Events Slider
    initScrollAnimations(); // Start animations
    initMusicControl(); // Initialize Music Control
    
    // Handle contact form
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', handleContactForm);
    }

    // Handle collaboration form
    const collaborationForm = document.getElementById('collaborationForm');
    if (collaborationForm) {
        collaborationForm.addEventListener('submit', handleCollaborationForm);
    }

    // Register Service Worker for PWA
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then(registration => {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                })
                .catch(err => {
                    console.log('ServiceWorker registration failed: ', err);
                });
        });
    }
});
