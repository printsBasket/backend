const EasyPostClient = require('@easypost/api');
const asyncHandler = require('express-async-handler');

// Helper to calculate distance in miles
function getDistanceFromLatLonInMiles(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 3959; // Radius of the earth in miles
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in miles
    return d.toFixed(1);
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

// @desc    Get shipping rates
// @route   POST /api/shipping/rates
// @access  Private
const getShippingRates = asyncHandler(async (req, res) => {
    const { address, city, postalCode, country, state, phone, cartItems } = req.body;

    if (!process.env.EASYPOST_API_KEY) {
        res.status(500);
        throw new Error('EasyPost API Key not configured');
    }

    const client = new EasyPostClient(process.env.EASYPOST_API_KEY);

    try {
        // 1. Create To Address (Verify to get coords if possible)
        const toAddress = await client.Address.create({
            name: req.user ? req.user.name : undefined,
            street1: address,
            city: city,
            state: state, 
            zip: postalCode,
            country: country || 'US',
            phone: phone || '8883225251',
            email: req.user ? req.user.email : undefined,
        });

        // 2. Create From Address (Company Location)
        // Using environment variables for company location, with defaults
        const fromAddress = await client.Address.create({
            company: 'Prints Basket',
            street1: process.env.COMPANY_ADDRESS || '95 Broadacre Dr',
            city: process.env.COMPANY_CITY || 'Kitchener',
            state: process.env.COMPANY_STATE || 'ON',
            zip: process.env.COMPANY_ZIP || 'N2R 0S5',
            country: process.env.COMPANY_COUNTRY || 'CA',
            phone: process.env.COMPANY_PHONE || '8883225251',
        });

        // 3. Create Parcel
        // Calculate total weight. EasyPost uses ounces.
        // Assuming ~16oz (1lb) per item quantity if no weight is specified in product.
        const totalWeight = cartItems && cartItems.length > 0 
            ? cartItems.reduce((acc, item) => acc + (16 * item.qty), 0)
            : 16;

        const parcel = await client.Parcel.create({
            weight: totalWeight,
            // Generic dimensions if unknown
            length: 10,
            width: 8,
            height: 4
        });

        // 4. Create Shipment
        const shipment = await client.Shipment.create({
            to_address: toAddress,
            from_address: fromAddress,
            parcel: parcel,
        });

        // Try to calculate distance
        let distance = null;
        try {
            // Known coordinates for company address (Kitchener, ON)
            const fromCoords = { latitude: 43.4255, longitude: -80.5112 };
            
            // Try to get destination coords from verification details
            let toCoords = null;
            if (toAddress.verifications && toAddress.verifications.delivery && toAddress.verifications.delivery.details) {
                toCoords = toAddress.verifications.delivery.details;
            }

            if (toCoords && fromCoords) {
                distance = getDistanceFromLatLonInMiles(
                    fromCoords.latitude, 
                    fromCoords.longitude, 
                    toCoords.latitude, 
                    toCoords.longitude
                );
            }
        } catch (calcError) {
            console.error('Distance calc error:', calcError);
        }
                // Filter rates to only show the specified carrier accounts
        // const allowedAccounts = [
        //     'ca_e3cbd16a6eb84914985d90875a6ec074', // Canada Post
        //     'ca_76d0939dc1ce4c99870bbc2844d8d02b', // FedEx
        //     'ca_c5f03a14c10d4fbab837e8a35b01c7df', // UPS
        //     'ca_b82a2962176446d09a48bc649977f467', // USPS
        //     'ca_fb3ad562209b4e7d930bd0f31f44f2fe'  // DHL Express
        // ];

        const allowedAccounts = [
            'ca_e3cbd16a6eb84914985d90875a6ec074', // Canada Post
            'ca_76d0939dc1ce4c99870bbc2844d8d02b', // FedEx
            'ca_c5f03a14c10d4fbab837e8a35b01c7df', // UPS
            'ca_b82a2962176446d09a48bc649977f467', // USPS
            'ca_fb3ad562209b4e7d930bd0f31f44f2fe'  // DHL Express
        ];
        
       
        shipment.rates.forEach((r, i) => {
        });

        
        const filteredRates = shipment.rates.filter(rate => allowedAccounts.includes(rate.carrier_account_id));
        
        // Log carrier error messages for debugging
        if (shipment.messages && shipment.messages.length > 0) {
            shipment.messages.forEach(msg => {
                if (msg.type === 'rate_error') {
                    console.log(`Carrier error [${msg.carrier}]: ${msg.message}`);
                }
            });
        }

        // If filtering removed all rates, fall back to all rates
        let finalRates = filteredRates.length > 0 ? filteredRates : shipment.rates;
        if (filteredRates.length === 0 && shipment.rates.length > 0) {
            console.log('WARNING: All rates were filtered out by carrier account IDs. Returning all available rates instead.');
        }

        // If no carrier rates at all, provide flat-rate fallback options
        if (finalRates.length === 0) {
            console.log('No carrier rates available. Providing flat-rate fallback options.');
            const isDomesticCA = (country || 'US').toUpperCase() === 'CA';
            const isDomesticUS = (country || 'US').toUpperCase() === 'US';
            
            const totalItems = cartItems && cartItems.length > 0 
                ? cartItems.reduce((acc, item) => acc + item.qty, 0)
                : 1;
            const weightMultiplier = Math.max(1, Math.ceil(totalItems / 3));

            if (isDomesticCA) {
                finalRates = [
                    { id: 'flat_standard_ca', carrier: 'Prints Basket', service: 'Standard Shipping (5-8 business days)', rate: (9.99 * weightMultiplier).toFixed(2), currency: 'CAD', delivery_days: 8 },
                    { id: 'flat_express_ca', carrier: 'Prints Basket', service: 'Express Shipping (2-4 business days)', rate: (16.99 * weightMultiplier).toFixed(2), currency: 'CAD', delivery_days: 4 },
                    { id: 'flat_priority_ca', carrier: 'Prints Basket', service: 'Priority Shipping (1-2 business days)', rate: (24.99 * weightMultiplier).toFixed(2), currency: 'CAD', delivery_days: 2 },
                ];
            } else if (isDomesticUS) {
                finalRates = [
                    { id: 'flat_standard_us', carrier: 'Prints Basket', service: 'Standard Shipping (5-8 business days)', rate: (8.99 * weightMultiplier).toFixed(2), currency: 'USD', delivery_days: 8 },
                    { id: 'flat_express_us', carrier: 'Prints Basket', service: 'Express Shipping (2-4 business days)', rate: (14.99 * weightMultiplier).toFixed(2), currency: 'USD', delivery_days: 4 },
                    { id: 'flat_priority_us', carrier: 'Prints Basket', service: 'Priority Shipping (1-2 business days)', rate: (22.99 * weightMultiplier).toFixed(2), currency: 'USD', delivery_days: 2 },
                ];
            } else {
                finalRates = [
                    { id: 'flat_standard_intl', carrier: 'Prints Basket', service: 'International Standard (10-15 business days)', rate: (19.99 * weightMultiplier).toFixed(2), currency: 'USD', delivery_days: 15 },
                    { id: 'flat_express_intl', carrier: 'Prints Basket', service: 'International Express (5-8 business days)', rate: (34.99 * weightMultiplier).toFixed(2), currency: 'USD', delivery_days: 8 },
                ];
            }
        }

                res.json({
                    rates: finalRates,
                    distance: distance
                });

    } catch (error) {
        console.error('EasyPost Error:', error);
        res.status(400);
        throw new Error('Could not calculate shipping rates: ' + error.message);
    }
});

module.exports = { getShippingRates };
