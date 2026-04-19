/**
 * Google Apps Script to create a feedback form for rwn Profile Lock.
 * 
 * How to use:
 * 1. Go to https://script.google.com
 * 2. Create a new blank project
 * 3. Delete the default myFunction() code
 * 4. Paste this entire file into the editor
 * 5. Click the Run button (▶) next to createFeedbackForm()
 * 6. Authorize the script when prompted
 * 7. Go to View → Logs (or press Ctrl+Enter) to see the form URL
 * 8. Copy the "Published URL" and paste it into the extension code
 *    (replace YOUR_GOOGLE_FORM_URL in pages/options.js, README.md, etc.)
 */

function createFeedbackForm() {
  const form = FormApp.create('rwn Profile Lock — Feedback');
  
  form.setDescription('Help improve rwn Profile Lock. Bug reports, feature requests, and general feedback are all welcome.');
  form.setConfirmationMessage('Thank you! Your feedback has been submitted.');
  form.setShowLinkToRespondAgain(false);
  
  // Question 1: Feedback type
  const typeItem = form.addMultipleChoiceItem();
  typeItem.setTitle('What type of feedback is this?');
  typeItem.setRequired(true);
  typeItem.setChoiceValues(['Bug report', 'Feature request', 'General feedback', 'Security concern']);
  
  // Question 2: Description
  const descItem = form.addParagraphTextItem();
  descItem.setTitle('Describe your feedback');
  descItem.setHelpText('Please be as detailed as possible. For bugs, include what you expected vs what happened.');
  descItem.setRequired(true);
  
  // Question 3: Chrome version
  const chromeItem = form.addTextItem();
  chromeItem.setTitle('Chrome version (optional)');
  chromeItem.setHelpText('Type chrome://version in your address bar to find this');
  
  // Question 4: Steps to reproduce
  const stepsItem = form.addParagraphTextItem();
  stepsItem.setTitle('Steps to reproduce (for bugs)');
  stepsItem.setHelpText('List the exact steps that led to the issue');
  stepsItem.setRequired(false);
  
  // Question 5: Contact email
  const emailItem = form.addTextItem();
  emailItem.setTitle('Email (optional)');
  emailItem.setHelpText('Only if you want us to follow up with you');
  
  // Output URLs
  const publishedUrl = form.getPublishedUrl();
  const editUrl = form.getEditUrl();
  
  Logger.log('=== rwn Profile Lock Feedback Form ===');
  Logger.log('Published URL (use this in the extension):');
  Logger.log(publishedUrl);
  Logger.log('');
  Logger.log('Edit URL (for you to manage responses):');
  Logger.log(editUrl);
  Logger.log('=======================================');
  
  // Also create a spreadsheet to collect responses
  const ss = SpreadsheetApp.create('rwn Profile Lock — Feedback Responses');
  form.setDestination(FormApp.DestinationType.SPREADSHEET, ss.getId());
  Logger.log('Response spreadsheet:');
  Logger.log(ss.getUrl());
}
