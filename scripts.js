// Confusion Matrix Heatmap
const confusionCtx = document.getElementById('confusionChart').getContext('2d');
new Chart(confusionCtx, {
    type: 'scatter',
    data: {
        datasets: [{
            label: 'True Negatives',
            data: [{x: 0, y: 0}],
            backgroundColor: 'rgba(102, 126, 234, 0.8)',
            pointRadius: 35,
        }, {
            label: 'False Positives', 
            data: [{x: 1, y: 0}],
            backgroundColor: 'rgba(239, 68, 68, 0.8)',
            pointRadius: 5,
        }, {
            label: 'False Negatives',
            data: [{x: 0, y: 1}], 
            backgroundColor: 'rgba(239, 68, 68, 0.8)',
            pointRadius: 10,
        }, {
            label: 'True Positives',
            data: [{x: 1, y: 1}],
            backgroundColor: 'rgba(16, 185, 129, 0.8)', 
            pointRadius: 25,
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            title: {
                display: true,
                text: 'Confusion Matrix Visualization',
                font: { size: 16 }
            },
            legend: {
                position: 'bottom'
            }
        },
        scales: {
            x: {
                type: 'linear',
                position: 'bottom',
                min: -0.5,
                max: 1.5,
                ticks: {
                    callback: function(value) {
                        return value === 0 ? 'Benign' : value === 1 ? 'Malignant' : '';
                    }
                },
                title: {
                    display: true,
                    text: 'Predicted'
                }
            },
            y: {
                min: -0.5,
                max: 1.5,
                ticks: {
                    callback: function(value) {
                        return value === 0 ? 'Benign' : value === 1 ? 'Malignant' : '';
                    }
                },
                title: {
                    display: true,
                    text: 'Actual'
                }
            }
        }
    }
});

// Performance Metrics Bar Chart
const metricsCtx = document.getElementById('metricsChart').getContext('2d');
new Chart(metricsCtx, {
    type: 'bar',
    data: {
        labels: ['Accuracy', 'Precision', 'Recall', 'F1-Score'],
        datasets: [{
            label: 'Performance %',
            data: [95.61, 97.50, 90.70, 93.98],
            backgroundColor: [
                'rgba(102, 126, 234, 0.8)',
                'rgba(16, 185, 129, 0.8)', 
                'rgba(251, 191, 36, 0.8)',
                'rgba(139, 92, 246, 0.8)'
            ],
            borderColor: [
                'rgba(102, 126, 234, 1)',
                'rgba(16, 185, 129, 1)',
                'rgba(251, 191, 36, 1)', 
                'rgba(139, 92, 246, 1)'
            ],
            borderWidth: 2,
            borderRadius: 8
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            title: {
                display: true,
                text: 'Model Performance Metrics',
                font: { size: 16 }
            },
            legend: {
                display: false
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                max: 100,
                ticks: {
                    callback: function(value) {
                        return value + '%';
                    }
                }
            }
        }
    }
});

// Dataset Distribution Pie Chart
const distributionCtx = document.getElementById('distributionChart').getContext('2d');
new Chart(distributionCtx, {
    type: 'doughnut',
    data: {
        labels: ['Benign (B)', 'Malignant (M)'],
        datasets: [{
            data: [357, 212],
            backgroundColor: [
                'rgba(16, 185, 129, 0.8)',
                'rgba(239, 68, 68, 0.8)'
            ],
            borderColor: [
                'rgba(16, 185, 129, 1)',
                'rgba(239, 68, 68, 1)'
            ],
            borderWidth: 3
        }]
    },
    options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            title: {
                display: true,
                text: 'Dataset Distribution (569 total samples)',
                font: { size: 16 }
            },
            legend: {
                position: 'bottom',
                labels: {
                    padding: 20
                }
            }
        }
    }
});
