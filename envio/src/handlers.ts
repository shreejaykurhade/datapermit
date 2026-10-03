import { indexer } from 'envio';
indexer.onEvent({contract:'DataPermit',event:'PermitPurchased',fields:{transaction:['hash'],block:['timestamp']}},async({event,context})=>{
 context.Purchase.set({id:`${event.chainId}-${event.params.permitId}`,permitId:event.params.permitId.toString(),datasetId:event.params.datasetId,buyer:event.params.buyer.toLowerCase(),publisher:event.params.publisher.toLowerCase(),amount:event.params.amount,expiresAt:event.params.expiresAt,quota:BigInt(event.params.quota),txHash:event.transaction.hash,timestamp:BigInt(event.block.timestamp),revoked:false});
});
indexer.onEvent({contract:'DataPermit',event:'PermitRevoked'},async({event,context})=>{
 const id=`${event.chainId}-${event.params.permitId}`;const purchase=await context.Purchase.get(id);if(purchase)context.Purchase.set({...purchase,revoked:true});
});
