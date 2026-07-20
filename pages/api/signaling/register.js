import { registerPeer } from '../../../lib/redis';
import { getClientIP } from '../../../lib/client-ip.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: '只允许POST请求' });
  }

  const { roomId, peerId, clientId, isInitiator } = req.body;
  const clientIP = getClientIP(req);

  if (!roomId || !peerId) {
    return res.status(400).json({ message: '缺少必要参数' });
  }

  try {
    const result = await registerPeer(
      roomId,
      peerId,
      isInitiator,
      clientIP,
      typeof clientId === 'string' && clientId ? clientId : clientIP,
    );

    if (result.notFound) {
      return res.status(404).json({ message: '房间不存在' });
    }

    if (result.roomFull) {
      return res.status(403).json({
        message: '房间已满，无法注册',
        roomFull: true
      });
    }

    if (result.alreadyRegistered) {
      console.log(`已存在相同的PeerId: ${peerId}, 跳过注册`);
      return res.status(200).json({
        success: true,
        peerId,
        roomId,
        ip: clientIP,
        alreadyRegistered: true
      });
    }
    return res.status(200).json({
      success: true,
      peerId,
      roomId,
      ip: clientIP
    });
  } catch (error) {
    console.error('Peer registration error:', error);
    return res.status(500).json({ message: '服务器错误' });
  }
}
