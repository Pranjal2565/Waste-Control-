// Data Layer - Handles CSV operations
const DATA = {
    regionsCSV: 'data/regions.csv',
    cleaningLogCSV: 'data/cleaning-log.csv',
    
    async loadRegions() {
        try {
            const response = await fetch(this.regionsCSV);
            const csvText = await response.text();
            return new Promise((resolve) => {
                Papa.parse(csvText, {
                    header: true,
                    dynamicTyping: true,
                    complete: (results) => resolve(results.data)
                });
            });
        } catch (error) {
            console.error('Error loading regions:', error);
            return [];
        }
    },
    
    async loadCleaningLog() {
        try {
            const response = await fetch(this.cleaningLogCSV);
            const csvText = await response.text();
            return new Promise((resolve) => {
                Papa.parse(csvText, {
                    header: true,
                    dynamicTyping: true,
                    complete: (results) => resolve(results.data)
                });
            });
        } catch (error) {
            console.error('Error loading cleaning log:', error);
            return [];
        }
    }
};