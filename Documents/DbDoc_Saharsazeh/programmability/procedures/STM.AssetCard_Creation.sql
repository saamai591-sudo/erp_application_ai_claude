
CREATE proc [STM].[AssetCard_Creation]
(
@AssetID nvarchar(max)
)

as
begin

declare @DestructionReason nvarchar(255)

select @DestructionReason =  ' ('+ dr.Title  +')' from ast.DestructionItem di
join ast.Destruction d on d.DestructionID = di.DestructionID
join ast.DestructionReason dr on dr.DestructionReasonID = d.DestructionReasonID
where di.AssetID = @AssetID

select 
	a.Plaque,
	a.Title,
	case a.AssetType when 1 then 'دارایی ثابت'
				 when 2 then 'دارایی نامشهود'
				 when 3 then 'سایر دارائیها'
				 end AssetType,
c.Number CreationNumber,
cfg.GetSaturnDate(c.Date,0) CreationDate,
case c.creationtype when 1 then 'استقرار'
					when 2 then 'خرید'
					when 3 then 'دریافت از انبار'
					when 4 then 'ساخت'
					when 5 then 'سایر'
					when 6 then 'احیاء دارایی'
					end creationtype,
case when p.Number is not null then 'شماره فاکتور: '+ cast(p.Number as varchar(20))
     when o.Number is not null then 'شماره حواله: '+ cast(o.Number as varchar(20))
	 when d.Number is not null then 'شماره خروج: '+ cast(d.Number as varchar(20))
	 end DocumentNumberString,
p.Number PurchaseInvoiceNumber,
o.number Outgoingnumber,
d.Number DestructionNumber,
a.BaseValue,
a.AccumulatedDepreciation + isnull(dep.value , 0) AccumulatedDepreciation,
case a.status when 1 then 'وضعیت نهایی: در جریان'
			  when 2 then 'وضعیت نهایی: خارج شده'+ ISNULL(@DestructionReason,'')
			  when 3 then 'وضعیت نهایی: فروش رفته'
			  when 4 then 'وضعیت نهایی: اسقاط شده'
			  when 5 then 'وضعیت نهایی: احیاء شده' end status

 from ast.Asset a
join ast.Creation c on c.CreationID = a.CreationID
left join vnd.PurchaseInvoiceItem pii on pii.PurchaseInvoiceItemID = c.PurchaseInvoiceItemID
left join vnd.PurchaseInvoice p on p.PurchaseInvoiceID = pii.PurchaseInvoiceID
left join stc.OutgoingItem oi on oi.OutgoingItemID = c.OutgoingItemID
left join stc.Outgoing o on o.OutgoingID = oi.OutgoingID
left join ast.DestructionItem di on di.DestructionItemID = c.DestructionItemID
left join ast.Destruction d on d.DestructionID = di.DestructionID
left join (
select assetid,sum(value) value from ast.Depreciation group by assetid
)dep on dep.AssetID = a.AssetID
where a.AssetID = @AssetID
end
