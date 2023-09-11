/* *
 * This sample demonstrates handling intents from an Alexa skill using the Alexa Skills Kit SDK (v2).
 * Please visit https://alexa.design/cookbook for additional examples on implementing slots, dialog management,
 * session persistence, api calls, and more.
 * */
const Alexa = require("ask-sdk-core");
const { Configuration, OpenAIApi } = require("openai");

const admin = require("firebase-admin");
const serviceAccount = require("service.json");
const moment = require("moment-timezone");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: "https://voice-based-system.firebaseio.com",
});

const DB = admin.firestore();
let conversation = [{ role: "system", content: "Let's play some game" }];

const configuration = new Configuration({
  // apiKey: "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",
});
const openai = new OpenAIApi(configuration);

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "LaunchRequest"
    );
  },
  handle(handlerInput) {
    const speakOutput = "Welcome to voice based system. What can i do for you";
    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
  },
};

const AskQuestionIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "AskQuestionIntent"
    );
  },
  async handle(handlerInput) {
    const { requestEnvelope } = handlerInput;
    let speakOutput = "Hello World";

    const question = Alexa.getSlotValue(requestEnvelope, "question");
    while (question !== "stop") {
      const chatCompletion = await openai.createChatCompletion({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: question }],
      });
      speakOutput = chatCompletion.data.choices[0].message.content;
      return handlerInput.responseBuilder
        .speak(speakOutput)
        .reprompt("What do you want to do next ?")
        .getResponse();
    }
  },
};

const PlayGameIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "PlayGameIntent"
    );
  },

  async handle(handlerInput) {
    const { requestEnvelope } = handlerInput;
    let speakOutput = "Hello World";

    const question = Alexa.getSlotValue(requestEnvelope, "game");
    let userMess = { role: "user", content: question };
    conversation.push(userMess);
    const chatCompletion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: conversation,
    });
    conversation.push(chatCompletion.data.choices[0].message);
    speakOutput = chatCompletion.data.choices[0].message.content;

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt()
      .getResponse();
  },
};

const PrescriptionIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "PrescriptionIntent"
    );
  },
  async handle(handlerInput) {
    const { requestEnvelope, serviceClientFactory } = handlerInput;
    let speakOutput = "prescription";

    //set reminder API
    const reminderApiClient =
      serviceClientFactory.getReminderManagementServiceClient();
    const { permissions } = requestEnvelope.context.System.user;

    //get intent slot
    const medicine = Alexa.getSlotValue(requestEnvelope, "medicine");
    const time = Alexa.getSlotValue(requestEnvelope, "time");
    const dose = Alexa.getSlotValue(requestEnvelope, "dose");
    const usage = Alexa.getSlotValue(requestEnvelope, "usage");

    //format the time for the reminder
    const timeSplit = time.split(":");
    const reminder_hour = timeSplit[0].toString();
    const reminder_minute = timeSplit[1].toString();
    const currentTime = moment.tz("Australia/Melbourne");
    //ask for user reminder permissions

    if (!permissions) {
      return handlerInput.responseBuilder
        .speak("Please grant permission")
        .addDirective({
          type: "Connections.SendRequest",
          name: "AskFor",
          payload: {
            "@type": "AskForPermissionsConsentRequest",
            "@version": "2",
            permissionScopes: [
              {
                permissionScope: "alexa::alerts:reminders:skill:readwrite",

                consentLevel: "ACCOUNT",
              },
            ],
          },
          token: "",
        })
        .getResponse();
    }

    //create reminder request for absolute

    /* const reminderRequest = 
                      {
                       "requestTime" : currentTime.format('YYYY-MM-DDTHH:mm:ss.sss'),
                       "trigger": {
                            "type" : "SCHEDULED_ABSOLUTE",
                            "scheduledTime" : currentTime.set({
                                hour: reminder_hour,
                                minute: reminder_minute,
                                second: '00.000'
                            
                            }).format('YYYY-MM-DDTHH:mm:ss.sss'),
                            "timeZoneId" : "Australia/Melbourne"
                       },
                       "alertInfo": {
                            "spokenInfo": {
                                "content": [{
                                    "locale": "en-US",
                                    "text": `It is time to take ${medicine}`,
                                      
                                }]
                            }
                        },
                        "pushNotification" : {                            
                             "status" : "ENABLED"
                        }
                      }*/

    try {
      //await reminderApiClient.createReminder(reminderRequest)
      await DB.collection("Prescriptions").add({
        medicine: medicine,
        time: time,
        dose: dose,
        usage: `${usage} times a day`,
      });

      speakOutput =
        "I have saved your prescription and set reminder for this prescription";
    } catch (err) {
      let errCode = err.response.code;
      let errMessage = "";

      if (errCode === "TRIGGER_SCHEDULED_TIME_IN_PAST") {
        errMessage =
          "Looks like you can't set a reminder for a time that's already gone by";
      }
      console.log("Err" + err);
      return handlerInput.responseBuilder.speak(errMessage).getResponse();
    }

    return handlerInput.responseBuilder.speak(speakOutput).getResponse();
  },
};

const UpdatePrescriptionIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) ===
        "UpdatePrescriptionIntent"
    );
  },

  async handle(handlerInput) {
    let speakOutput = "";
    const { requestEnvelope } = handlerInput;
    const medicine = Alexa.getSlotValue(requestEnvelope, "u_medicine");
    const time = Alexa.getSlotValue(requestEnvelope, "u_time");

    const sessionAtrribute =
      handlerInput.attributesManager.getSessionAttributes();

    sessionAtrribute.medicine = medicine;
    sessionAtrribute.time = time;

    handlerInput.attributesManager.setSessionAttributes(sessionAtrribute);

    try {
      const querySnapshot = await DB.collection("Prescriptions")
        .where("medicine", "==", medicine)
        .where("time", "==", time)
        .get();
      if (!querySnapshot.empty) {
        return handlerInput.responseBuilder
          .speak(speakOutput)
          .addDelegateDirective({
            name: "UpdateMedicineIntent",
            confirmationStatus: "NONE",
            slots: {},
          })
          .getResponse();
      } else {
        return handlerInput.responseBuilder
          .speak("Sorry. Prescripton does not exist.")
          .getResponse();
      }
    } catch (err) {
      console.log(err);
    }
  },
};
const UpdateMedicineIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) ===
        "UpdateMedicineIntent"
    );
  },
  async handle(handlerInput) {
    const { requestEnvelope } = handlerInput;
    let speakOutput = "Update Medicine";

    const sessionAttribute =
      handlerInput.attributesManager.getSessionAttributes();

    let medicine_session = sessionAttribute.medicine;
    let time_session = sessionAttribute.time;

    const medicine_update = Alexa.getSlotValue(
      requestEnvelope,
      "update_medicine"
    );
    const time_update = Alexa.getSlotValue(requestEnvelope, "u_time");
    const usage_update = Alexa.getSlotValue(requestEnvelope, "update_usage");
    const dose_update = Alexa.getSlotValue(requestEnvelope, "update_dose");

    const collection_update = await DB.collection("Prescriptions")
      .where("medicine", "==", medicine_session)
      .where("time", "==", time_session);

    await collection_update
      .get()
      .then((querySnapshot) => {
        const batch = DB.batch();
        querySnapshot.forEach((doc) => {
          const ref = DB.collection("Prescriptions").doc(doc.id);
          batch.update(ref, {
            medicine: medicine_update,
            time: time_update,
            usage: usage_update,
            dose: dose_update,
          });
          return batch.commit();
        });
      })
      .then(() => {
        speakOutput = "Prescripton has been updated";
      })
      .catch((err) => {
        console.log(err);
      });

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt()
      .getResponse();
  },
};
const DeletePrescriptionIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) ===
        "DeletePrescriptionIntent"
    );
  },
  async handle(handlerInput) {
    const { requestEnvelope } = handlerInput;

    const medicine_delete = Alexa.getSlotValue(
      requestEnvelope,
      "delete_medicine"
    );
    const time_delete = Alexa.getSlotValue(requestEnvelope, "delete_time");
    let speakOutput = "";

    const collection_delete = await DB.collection("Prescriptions")
      .where("medicine", "==", medicine_delete)
      .where("time", "==", time_delete)
      .get();
    const delete_prescription = await DB.collection("Prescriptions")
      .where("medicine", "==", medicine_delete)
      .where("time", "==", time_delete);
    if (!collection_delete.empty) {
      delete_prescription
        .get()
        .then((querySnapshot) => {
          querySnapshot.forEach((doc) => {
            const ref = DB.collection("Prescriptions").doc(doc.id);
            ref
              .delete()
              .then(() => {
                console.log("Prescription has been deleted");
              })
              .catch((err) => {
                console.log(err);
              });
          });
        })
        .catch((err) => {
          console.log(err);
        });
    } else {
      return handlerInput.responseBuilder
        .speak("Prescription does not exist")
        .getResponse();
    }
    return handlerInput.responseBuilder
      .speak("Prescription has been deleted")
      .getResponse();
  },
};

const TellStoryIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "TellStoryIntent"
    );
  },
  async handle(handlerInput) {
    const { requestEnvelope } = handlerInput;
    let speakOutput = "";

    const story = Alexa.getSlotValue(requestEnvelope, "story");
    const chatCompletion = await openai.createChatCompletion({
      model: "gpt-3.5-turbo",
      messages: [
        { role: "system", content: "tell 50 words joke story" },

        { role: "user", content: story },
      ],
    });
    speakOutput = chatCompletion.data.choices[0].message.content;
    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt()
      .getResponse();
  },
};

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.HelpIntent"
    );
  },
  handle(handlerInput) {
    const speakOutput = "You can say hello to me! How can I help?";

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
  },
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      (Alexa.getIntentName(handlerInput.requestEnvelope) ===
        "AMAZON.CancelIntent" ||
        Alexa.getIntentName(handlerInput.requestEnvelope) ===
          "AMAZON.StopIntent")
    );
  },
  handle(handlerInput) {
    const speakOutput = "Goodbye!";

    return handlerInput.responseBuilder.speak(speakOutput).getResponse();
  },
};
/* *
 * FallbackIntent triggers when a customer says something that doesn’t map to any intents in your skill
 * It must also be defined in the language model (if the locale supports it)
 * This handler can be safely added but will be ingnored in locales that do not support it yet
 * */
const FallbackIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) ===
        "AMAZON.FallbackIntent"
    );
  },
  handle(handlerInput) {
    const speakOutput = "Sorry, I don't know about that. Please try again.";

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
  },
};
/* *
 * SessionEndedRequest notifies that a session was ended. This handler will be triggered when a currently open
 * session is closed for one of the following reasons: 1) The user says "exit" or "quit". 2) The user does not
 * respond or says something that does not match an intent defined in your voice model. 3) An error occurs
 * */
const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) ===
      "SessionEndedRequest"
    );
  },
  handle(handlerInput) {
    console.log(
      `~~~~ Session ended: ${JSON.stringify(handlerInput.requestEnvelope)}`
    );
    // Any cleanup logic goes here.
    return handlerInput.responseBuilder.getResponse(); // notice we send an empty response
  },
};
/* *
 * The intent reflector is used for interaction model testing and debugging.
 * It will simply repeat the intent the user said. You can create custom handlers for your intents
 * by defining them above, then also adding them to the request handler chain below
 * */
const IntentReflectorHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest"
    );
  },
  handle(handlerInput) {
    const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
    const speakOutput = `You just triggered ${intentName}`;

    return (
      handlerInput.responseBuilder
        .speak(speakOutput)
        //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
        .getResponse()
    );
  },
};
/**
 * Generic error handling to capture any syntax or routing errors. If you receive an error
 * stating the request handler chain is not found, you have not implemented a handler for
 * the intent being invoked or included it in the skill builder below
 * */
const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    const speakOutput =
      "Sorry, I had trouble doing what you asked. Please try again.";
    console.log(`~~~~ Error handled: ${JSON.stringify(error)}`);

    return handlerInput.responseBuilder
      .speak(speakOutput)
      .reprompt(speakOutput)
      .getResponse();
  },
};

const requestInterceptor = {
  process(handlerInput) {
    handlerInput.attributeManager.setRequestAttribute({ message: "Hey" });
  },
};

/**
 * This handler acts as the entry point for your skill, routing all request and response
 * payloads to the handlers above. Make sure any new handlers or interceptors you've
 * defined are included below. The order matters - they're processed top to bottom
 * */
exports.handler = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    AskQuestionIntentHandler,
    PlayGameIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    FallbackIntentHandler,
    PrescriptionIntentHandler,
    UpdatePrescriptionIntentHandler,
    TellStoryIntentHandler,
    UpdateMedicineIntentHandler,
    DeletePrescriptionIntentHandler,
    SessionEndedRequestHandler,
    IntentReflectorHandler
  )
  .addErrorHandlers(ErrorHandler)
  .withApiClient(new Alexa.DefaultApiClient())
  .lambda();
