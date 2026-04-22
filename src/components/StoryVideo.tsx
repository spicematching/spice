import { useEffect } from 'react';
import { StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';

type Props = {
  uri: string;
  active?: boolean; // true: 再生 / false: 一時停止（プレイヤー自体はバッファ保持）
  style?: StyleProp<ViewStyle>;
};

/**
 * expo-video ベースの高速動画プレイヤー。
 * AVPlayer/ExoPlayer をネイティブで直接使用し、expo-av より大幅に起動が速い。
 * active=false のときも player は生かしたまま pause するので、
 * 再アクティブ化時にほぼ即時再生できる。
 */
export function StoryVideo({ uri, active = true, style }: Props) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.muted = true;
    if (active) p.play();
  });

  useEffect(() => {
    if (!player) return;
    if (active) {
      player.play();
    } else {
      player.pause();
    }
  }, [active, player]);

  return (
    <VideoView
      player={player}
      style={style ?? StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
      fullscreenOptions={{ allowsVideoFrameAnalysis: false }}
      allowsPictureInPicture={false}
    />
  );
}
