import * as React from "react";
import { Grid } from "semantic-ui-react";

import "../styles/chat.css";
import { RouteComponentProps, Route } from "react-router";
import { model, Actions } from "../redux";
import {
  checkSession,
  getChannels,
  getChannelMessages,
  getUsers,
  setCurrentChannel,
  showMessageBar
} from "../redux/operations/operations";
import { Dispatch, connect } from "react-redux";
import { bindActionCreators } from "redux";
import { ChannelWithName, ChannelWithID } from "../redux/selectors";
import UserProfile from "../components/UserProfile";
import UserProfileLoader from "../components/loaders/UserProfileLoader";
import { List } from "react-content-loader";
import ChannelsAndUsersList from "../components/ChannelsAndUsersList";
import Scrollbars from "react-custom-scrollbars";
import MessageContainer from "./MessageContainer";
import { deleteToken } from "../redux/util";
import { initiateWebSocketConnection } from "../redux/operations/websocket";

interface Props extends DispatchProps, StateProps {}

interface State {
  loading: boolean;
}

class ChatNew extends React.Component<Props & RouteComponentProps<any>, State> {
  readonly state = {
    loading: true
  };

  async componentDidMount() {
    // Load session state. If get session fails,
    // then push client back to login page for authentication
    let resp = await this.props.checkSession!();
    if (resp !== null) {
      this.props.history.push(
        "/?redir=" + encodeURIComponent(this.props.location.pathname)
      );
      return;
    }

    await this.props.initiateWebSocketConnection!();

    // Load users & channels list concurrently. If both
    // fetch calls return null then it was succesful. If not
    // then push client back to login page.
    let [u, c] = await Promise.all([
      this.props.getUsers!(),
      this.props.getChannels!()
    ]);
    if (u !== null || c !== null) {
      deleteToken();
      this.props.history.push(
        "/?redir=" + encodeURIComponent(this.props.location.pathname)
      );
      return;
    }

    // If the current route path has no specific channel ID
    // then set it to general channel. Else the URL pathname contains the channel ID.
    let channel = null;
    if (this.props.match.isExact) {
      // true if current route path is /channel or /channel/
      channel = ChannelWithName(this.props.channels, "general")!;
      this.props.history.replace(`/channel/${channel.id}`);
    } else {
      let channelid = this.props.location.pathname.split("/channel/")[1]!;
      channel = ChannelWithID(this.props.channels, channelid);
      if (channel === null) {
        channel = ChannelWithName(this.props.channels, "general")!;
        this.props.history.replace(`/channel/${channel.id}`);
      }
    }

    // Set current channel
    await this.props.setCurrentChannel!(channel);

    // Fetch current channel's messages
    await this.props.getChannelMessages!(channel.id);

    this.setState({ loading: false });
  }

  render() {
    const { loading } = this.state;
    const {
      currentuser,
      channels,
      users,
      currentchannel,
      messages
    } = this.props;

    return (
      <Grid id="chat-container" columns="equal">
        <Grid.Column
          tablet="4"
          computer="3"
          widescreen="2"
          only="tablet"
          className="bg-gray"
          id="sidebar"
        >
          <Scrollbars autoHide>
            {loading ? (
              <UserProfileLoader />
            ) : (
              <UserProfile user={currentuser} />
            )}
            {loading ? (
              <List style={{ padding: "10px", width: "100%" }} />
            ) : (
              <ChannelsAndUsersList
                channels={channels}
                users={users}
                currentChannel={currentchannel}
                currentUser={currentuser}
              />
            )}
          </Scrollbars>
        </Grid.Column>
        <Grid.Column id="messages">
          <Route
            path="/channel/:id"
            // tslint:disable-next-line:jsx-no-lambda
            render={(props) => (
              <MessageContainer
                loading={loading}
                messages={messages}
                currentchannel={currentchannel}
                {...props}
              />
            )}
          />
        </Grid.Column>
      </Grid>
    );
  }
}

interface StateProps {
  users: model.User[];
  channels: model.Channel[];
  currentchannel: model.Channel | null;
  currentuser: model.User | null;
  messages: model.Message[];
}

const mapStateToProps = (state: model.StoreState): StateProps => ({
  users: state.users,
  channels: state.channels,
  currentchannel: state.currentChannel,
  currentuser: state.currentUser,
  messages: state.messages
});

interface DispatchProps {
  checkSession?: typeof checkSession;
  getChannels?: typeof getChannels;
  getChannelMessages?: typeof getChannelMessages;
  getUsers?: typeof getUsers;
  showMessageBar?: typeof showMessageBar;
  setCurrentChannel?: typeof setCurrentChannel;
  initiateWebSocketConnection?: typeof initiateWebSocketConnection;
}

const mapDispatchToProps = (dispatch: Dispatch<Actions>): DispatchProps => ({
  ...bindActionCreators(
    {
      checkSession,
      getChannels,
      getUsers,
      getChannelMessages,
      showMessageBar,
      setCurrentChannel,
      initiateWebSocketConnection
    },
    dispatch
  )
});

export default connect<Props>(
  mapStateToProps,
  mapDispatchToProps
)(ChatNew);
