const rideModel = require('../models/ride.model');
const mapService = require('./maps.service');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

async function getFare(pickup, destination) {
    if (!pickup || !destination) {
      throw new Error("Pickup and destination are required");
    }
  
    const distanceTime = await mapService.getDistanceTime(pickup, destination);
  
    // Debugging log
    console.log("DistanceTime Response:", distanceTime);
  
    // Ensure response contains required data
    if (!distanceTime || !distanceTime.distance || !distanceTime.time) {
      throw new Error("Failed to get distance and duration data");
    }
  
    // Extract numeric values from API response
    const distanceKm = parseFloat(distanceTime.distance.replace(" km", "")); // Convert "391 km" → 391
    const timeParts = distanceTime.time.match(/\d+/g); // Extract numbers from "7 hours 17 mins"
  
    // Convert time to minutes
    const durationMins =
      timeParts.length === 2
        ? parseInt(timeParts[0]) * 60 + parseInt(timeParts[1]) // "7 hours 17 mins" → 437
        : parseInt(timeParts[0]); // If only minutes are present
  
    const baseFare = { auto: 25, car: 40, moto: 15 };
    const perKmRate = { auto: 8, car: 10, moto: 4 };
    const perMinuteRate = { auto: 2, car: 3, moto: 1.5 };
  
    const fare = {
      auto: Math.round(
        baseFare.auto +
          distanceKm * perKmRate.auto +
          durationMins * perMinuteRate.auto
      ),
      car: Math.round(
        baseFare.car +
          distanceKm * perKmRate.car +
          durationMins * perMinuteRate.car
      ),
      moto: Math.round(
        baseFare.moto +
          distanceKm * perKmRate.moto +
          durationMins * perMinuteRate.moto
      ),
    };
  
    return fare;
  }
  
  module.exports.getFare = getFare;


function getOtp(num) {
    function generateOtp(num) {
        const otp = crypto.randomInt(Math.pow(10, num - 1), Math.pow(10, num)).toString();
        return otp;
    }
    return generateOtp(num);
}


module.exports.createRide = async ({
    user, pickup, destination, vehicleType
}) => {
    if (!user || !pickup || !destination || !vehicleType) {
        throw new Error('All fields are required');
    }

    const fare = await getFare(pickup, destination);



    const ride = rideModel.create({
        user,
        pickup,
        destination,
        otp: getOtp(6),
        fare: fare[ vehicleType ]
    })

    return ride;
}

module.exports.confirmRide = async ({
    rideId, captain
}) => {
    if (!rideId) {
        throw new Error('Ride id is required');
    }

    await rideModel.findOneAndUpdate({
        _id: rideId
    }, {
        status: 'accepted',
        captain: captain._id
    })

    const ride = await rideModel.findOne({
        _id: rideId
    }).populate('user').populate('captain').select('+otp');

    if (!ride) {
        throw new Error('Ride not found');
    }

    return ride;

}

module.exports.startRide = async ({ rideId, otp, captain }) => {
    if (!rideId || !otp) {
        throw new Error('Ride id and OTP are required');
    }

    const ride = await rideModel.findOne({
        _id: rideId
    }).populate('user').populate('captain').select('+otp');

    if (!ride) {
        throw new Error('Ride not found');
    }

    if (ride.status !== 'accepted') {
        throw new Error('Ride not accepted');
    }

    if (ride.otp !== otp) {
        throw new Error('Invalid OTP');
    }

    await rideModel.findOneAndUpdate({
        _id: rideId
    }, {
        status: 'ongoing'
    })

    return ride;
}

module.exports.endRide = async ({ rideId, captain }) => {
    if (!rideId) {
        throw new Error('Ride id is required');
    }

    const ride = await rideModel.findOne({
        _id: rideId,
        captain: captain._id
    }).populate('user').populate('captain').select('+otp');

    if (!ride) {
        throw new Error('Ride not found');
    }

    if (ride.status !== 'ongoing') {
        throw new Error('Ride not ongoing');
    }

    await rideModel.findOneAndUpdate({
        _id: rideId
    }, {
        status: 'completed'
    })

    return ride;
}

