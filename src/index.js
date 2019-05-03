/* eslint max-len: [0] */
const { ReleaseCommunication } = require('./facades');
const { DEFAULT_HEADING, EMPTY_MESSAGE } = require('./constants');
const logger = require('./logger');
const Team = require('./factories/Team');
const Message = require('./factories/Message');
const {
  populateMessages, teams, nameSort, formatMessages, generateSlackFormatterUrl,
} = require('./utils');

const defaultTeam = Team();
const teamList = teams.length ? teams.map(team => Team(team)) : [];

const createAttachment = (hasMessages, { owner, repo }) => {
  let message = EMPTY_MESSAGE;
  let attachments = {};

  if (!hasMessages) {
    return { message, attachments };
  }

  // add all the PRs if there are any
  message = DEFAULT_HEADING`${owner}/${repo}`;
  attachments = [];

  const teamsToAttach = [...teamList, defaultTeam];

  teamsToAttach.forEach((team) => {
    const msg = Message('slack', team);
    const attachment = msg.generate();

    if (attachment) {
      attachments.push(attachment);
    }
  });

  return { message, attachments };
};

module.exports = async function App(config) {
  const {
    repo, owner, tagId, domain: githubDomain,
  } = config.get('github');
  const { teamDomain: jiraTeam } = config.get('jira');
  const { channel, channelUrl } = config.get('slack');

  const releaseCommunication = new ReleaseCommunication({
    owner,
    repo,
    channel,
    channelUrl,
    tagId,
  });

  const diff = await releaseCommunication.diff();
  const changes = await releaseCommunication.parseDiff(diff);
  const messages = changes.reduce((acc, change) => {
    const changeMessages = formatMessages({
      change,
      owner,
      repo,
      githubDomain,
      jiraTeam,
    });

    if (changeMessages.length) {
      return [...acc, ...changeMessages];
    }

    return acc;
  }, []);

  const sortedMessages = messages.sort(nameSort);

  populateMessages(defaultTeam)(teamList, sortedMessages);

  const { message, attachments } = createAttachment(messages.length, { owner, repo });

  logger.info(`\n Slack Formatter Url. CMD+Click to open in your default browser \n \n ${generateSlackFormatterUrl(attachments)}`);

  await releaseCommunication.sendMessage(message, attachments);
};
