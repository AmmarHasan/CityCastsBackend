'use strict';
var AWS = require('aws-sdk');
// Load credentials and set region from JSON file
AWS.config.loadFromPath('./aws/secret/config.json');

var userData64 = new Buffer(`
  #!/bin/bash
  set -e -x
  curl --silent --location https://rpm.nodesource.com/setup_9.x | bash -
  sudo yum install -y git nodejs
  git clone https://github.com/AmmarHasan/CityCastsBackend.git && cd CityCastsBackend
  sudo npm install -g nodemon
  sudo npm install
  DEBUG=express:* nodemon .
`).toString('base64');

var autoscaling = new AWS.AutoScaling();
var cloudwatch = new AWS.CloudWatch();

var launchConfiguration = {
  IamInstanceProfile: 'arn:aws:iam::002511670477:instance-profile/accessS3',
  ImageId: 'ami-0233214e13e500f77',
  InstanceType: 't2.micro',
  LaunchConfigurationName: 'sdk-launch-config',
  SecurityGroups: ['default'],
  UserData: userData64,
  KeyName: 'awsSdkKP',
};

var AutoScalingGroup = {
  AutoScalingGroupName: 'autoScalingSDK',
  AvailabilityZones: [
    'eu-central-1a',
  ],
  HealthCheckGracePeriod: 120,
  HealthCheckType: 'ELB',
  LaunchConfigurationName: 'sdk-launch-config',
  LoadBalancerNames: [
    'loadBalancerSdk',
  ],
  MaxSize: 3,
  MinSize: 1,
};

var scaleOut = {
  AdjustmentType: 'ChangeInCapacity',
  AutoScalingGroupName: 'autoScalingSDK',
  PolicyName: 'ScaleOut',
  ScalingAdjustment: 1,
  Cooldown: 30,
};

var scaleIn = {
  AdjustmentType: 'ChangeInCapacity',
  AutoScalingGroupName: 'autoScalingSDK',
  PolicyName: 'ScaleIn',
  ScalingAdjustment: -1,
  Cooldown: 30,
};

var data1, data2;

function launchConfigurationCallBack(err, data) {
  if (err) console.log(err, err.stack); // an error occurred
  else {
    console.log('LaunchConfiguration created successfully\n', data);           // successful response
    autoscaling.createAutoScalingGroup(
      AutoScalingGroup,
      AutoScalingGroupCreation
    );
  }
}

function scaleOutPolicyCallBack(err, data) {
  if (err) console.log(err, err.stack); // an error occurred
  else {
    console.log('ScaleOut policy created successfully\n', data);           // successful response
    data1 = data.PolicyARN;

    var scaleOut = {
      AlarmName: 'ScaleOut', /* required */
      ComparisonOperator: 'GreaterThanOrEqualToThreshold', /* required */
      EvaluationPeriods: 1, /* required */
      MetricName: 'RequestCount', /* required */
      Namespace: 'AWS/ELB', /* required */
      Period: 60, /* required */
      Threshold: 7.0, /* required */
      AlarmDescription: 'This will be used to scale out',
      DatapointsToAlarm: 1,
      Dimensions: [
        {
          Name: 'LoadBalancerName', /* required */
          Value: 'loadBalancerSdk', /* required */
        },
        /* more items */
      ],
      AlarmActions: [data1],
      Statistic: 'Sum',
    };

    cloudwatch.putMetricAlarm(scaleOut, function(err, data) {
      if (err) console.log(err, err.stack); // an error occurred
      else console.log('Increase Instance alarm created successfully\n', data);           // successful response
    });
  }
}

function scaleInPolicyCallBack(err, data) {
  if (err) console.log(err, err.stack); // an error occurred
  else {
    console.log('ScaleIn policy created successfully\n', data);           // successful response
    data2 = data.PolicyARN;
    var scaleIn = {
      AlarmName: 'ScaleIn', /* required */
      ComparisonOperator: 'LessThanOrEqualToThreshold', /* required */
      EvaluationPeriods: 1, /* required */
      MetricName: 'RequestCount', /* required */
      Namespace: 'AWS/ELB', /* required */
      Period: 60, /* required */
      Threshold: 2.0, /* required */
      AlarmDescription: 'This will be used to scale in',
      DatapointsToAlarm: 1,
      Dimensions: [
        {
          Name: 'LoadBalancerName', /* required */
          Value: 'loadBalancerSdk', /* required */
        },
        /* more items */
      ],
      AlarmActions: [data2],
      Statistic: 'Minimum',
    };
    cloudwatch.putMetricAlarm(scaleIn, function(err, data) {
      if (err) console.log(err, err.stack); // an error occurred
      else console.log('Decrease Instance alarm created successfully\n', data);           // successful response
    });
  }
}

function AutoScalingGroupCreation(err, data) {
  if (err) console.log(err, err.stack); // an error occurred
  else {
    console.log('AutoScaling Group created successfully\n', data);           // successful response
    autoscaling.putScalingPolicy(scaleOut, scaleOutPolicyCallBack);
    autoscaling.putScalingPolicy(scaleIn, scaleInPolicyCallBack);
  }
}

autoscaling.createLaunchConfiguration(
  launchConfiguration,
  launchConfigurationCallBack
);
