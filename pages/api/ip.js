import { getCloudflareContext } from '@opennextjs/cloudflare';
import { storeIPInfo, getIPInfo } from '../../lib/redis';
import { getClientIP } from '../../lib/client-ip.mjs';
import {
  createCloudflareIpInfo,
  createIpInfoFromProvider,
  createUnavailableIpInfo,
} from '../../lib/ip-location.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ message: '只允许GET请求' });
  }

  // 获取roomId和peerId参数
  const { roomId, peerId } = req.query;
  const ip = getClientIP(req);
  let cf = req.cf || {};

  try {
    cf = getCloudflareContext().cf || cf;
  } catch (contextError) {
    console.warn('Cloudflare request context unavailable, using provider fallback:', contextError.message);
  }

  try {
    // Cloudflare resolves the same incoming IP that getClientIP reads from
    // CF-Connecting-IP, so its coordinates cannot drift to a different IP.
    const cloudflareIpInfo = createCloudflareIpInfo(ip, cf);

    if (cloudflareIpInfo) {
      if (roomId && peerId) {
        try {
          await storeIPInfo(roomId, peerId, cloudflareIpInfo);
        } catch (storeError) {
          console.error(`存储Cloudflare IP信息失败: ${storeError.message}`);
        }
      }

      return res.status(200).json(cloudflareIpInfo);
    }

    // Local development and uncommon requests may not have request.cf.
    // Keep ipinfo as a secondary source, never as fabricated fixed coordinates.
    try {
      const response = await fetch(`https://ipinfo.io/${ip}/json`);
      
      if (response.ok) {
        const ipData = await response.json();
        const ipInfo = createIpInfoFromProvider(ip, ipData);

        if (!ipInfo) throw new Error('IP provider returned invalid coordinates');
        
        // 如果提供了roomId和peerId，直接将IP信息存储到房间状态对象
        if (roomId && peerId) {
          console.log(`接收到IP请求与存储：roomId=${roomId}, peerId=${peerId}`, ipInfo);
          
          try {
            await storeIPInfo(roomId, peerId, ipInfo);
            console.log(`已存储IP信息: roomId=${roomId}, peerId=${peerId}`);
            
            // 验证存储是否成功
            const stored = await getIPInfo(roomId, peerId);
            if (!stored) {
              console.warn(`存储IP信息失败验证：roomId=${roomId}, peerId=${peerId}`);
            }
          } catch (storeError) {
            console.error(`存储IP信息失败: ${storeError.message}`);
          }
        } else {
          console.log('未提供roomId或peerId，IP信息未持久化');
        }
        
        // 返回IP信息
        return res.status(200).json(ipInfo);
      } else {
        throw new Error('Failed to fetch IP info');
      }
    } catch (error) {
      console.error('Error fetching IP info, returning location unavailable:', error);
      const fallbackIpInfo = createUnavailableIpInfo(ip, cf);
      
      // 如果提供了roomId和peerId，将回退数据也存储到房间状态对象
      if (roomId && peerId) {
        try {
          await storeIPInfo(roomId, peerId, fallbackIpInfo);
          console.log(`已存储回退IP信息: roomId=${roomId}, peerId=${peerId}`);
        } catch (storeError) {
          console.error(`存储回退IP信息失败: ${storeError.message}`);
        }
      }
      
      return res.status(200).json(fallbackIpInfo);
    }
  } catch (error) {
    console.error('Error in IP handler:', error);
    
    return res.status(200).json({
      ...createUnavailableIpInfo(ip, cf),
      error: error.message,
    });
  }
}
