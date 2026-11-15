
CREATE   VIEW [CNT].VWContractSubject
AS
  with 
  TempAccumulated 
	as
	(
		select i.ContractSubjectID,Amount,ROW_NUMBER() over(partition by i.ContractSubjectID order by h.Number desc) Rno 
		from cnt.ContractStatementItem i
		join cnt.ContractStatement h on i.ContractStatementID = h.ContractStatementID
		join cnt.ContractStatementType t on t.ContractStatementTypeID = h.ContractStatementTypeID
		join cnt.Contract c on c.ContractID = h.ContractID
		where t.Type in (1,4)
		and c.StatementDeliverySection = 1
	),
  Accumulated
	as
	(
		select ContractSubjectID,Amount 
		from TempAccumulated
		where Rno=1
	),
  Net 
	as
	(
		select i.ContractSubjectID,sum(i.Amount) Amount
		from cnt.ContractStatementItem i
		join cnt.ContractStatement h on i.ContractStatementID = h.ContractStatementID
		join cnt.ContractStatementType t on t.ContractStatementTypeID = h.ContractStatementTypeID
		join cnt.Contract c on c.ContractID = h.ContractID
		where t.Type in (1,4)
		and c.StatementDeliverySection = 2
		group by i.ContractSubjectID
	),
  Purchase 
	as
	(
		select i.ContractSubjectID,sum(i.Price) Amount
		from vnd.PurchaseInvoiceItem i
		group by i.ContractSubjectID
	),
  cte 
	as
	(
		select * from Accumulated
		union all
		select * from Net
		union all
		select * from Purchase
	)

	select src.*,
			src.Price - ISNULL(cte.Amount, 0 ) as Remain
			from (
	select a.ContractSubjectID,
		   case when b.ParentID is null 
					then b.ContractID 
				else b.ParentID 
			end ContractID,
		   Price,
		   a.Description Title,
		   a.Description2 Title2,
		   a.stuffid,
		   cast(RowIndex as int) RowIndex,
		   cast( case when b.ParentID is null 
					then 0
				else 1
			end as bit)Issupplementary,
		   case when b.ParentID is null 
					then Price
				else 0 
			end FirstPrice,
			acc.SlFullCode(
							case when a.SlID is not null then a.SlID
								 when sd.SlID is not null then sd.SlID
								 else wip.SlID end
						  ) SlCode,
			sl.Title SLTitle,
			sl.Title2 SLTitle2,
			a.Quantity,
			a.Fee,
			a.CurrencyID,
			a.SlID,
			s.Title StuffTitle,
			s.Title2 StuffTitle2,
			c.Title CurrencyTitle,
			c.Title2 CurrencyTitle2,
			a.Type,
			a.UniqueTaxID,
			b.PartyID ContractPartyID,
			prt.DlID PartyDlID,
			a.DlID,
			dl.Code AS DlCode,
			dl.Title AS DLTitle,
			dl.Title2 AS DLTitle2

	from CNT.ContractSubject a
	join cfg.Currency c on c.CurrencyID = a.CurrencyID
	join cnt.Contract b
		on a.ContractID = b.ContractID
	join cfg.Party prt on b.PartyID = prt.PartyID
	left join stf.VWStuff s
		on s.StuffID = a.StuffID
	left join stf.StuffDetail sd
		on sd.StuffID = a.StuffID
	left join stf.StockDocumentTypeSlDl wip 
		on wip.StuffAccountGroupID = s.StuffAccountGroupID 
		and wip.StockDocumentTypeID = 3
	left join acc.sl
		on sl.SlID = case when a.SlID is not null then a.SlID
								 when sd.SlID is not null then sd.SlID
								 else wip.SlID end
	left join acc.dl
		on dl.DlID =  a.DlID
	where a.ContractSubjectID not in
	(
		select isnull(ParentID,0)
		 from CNT.ContractSubject
	)
	and a.ParentID is null

	union all

	select  ContractSubjectID,
			ContractID,
			b.Price,
			Description,
			Description2,
			stuffid,
			cast(RowIndex as int) RowIndex,
			cast(1 as bit) Issupplementary,
			FirstPrice,
			SlCode,
			SLTitle,
			SLTitle2,
			Quantity,
			Fee,
			CurrencyID,
			SlID,
			StuffTitle,
			StuffTitle2,
			CurrencyTitle,
			CurrencyTitle2,
			Type,
			UniqueTaxID,
			 ContractPartyID,
			PartyDlID,
			DlID,
			DlCode,
			DLTitle,
			DLTitle2
	from
	(
		select ROW_NUMBER() over(partition by  a.ParentID order by date desc) Rno,
			   a.ParentID ContractSubjectID,
			   a.Price,
			   date,
			   b.ParentID ContractID,
			   p.RowIndex,
			   a.Description,
			   a.Description2,
			   a.StuffID,
			   p.Price FirstPrice,
				acc.SlFullCode(
								case when a.SlID is not null then a.SlID
									 when sd.SlID is not null then sd.SlID
									 else wip.SlID end
							  ) SlCode,
			   sl.Title SLTitle,
			   sl.Title2 SLTitle2,
			   a.Quantity,
			   a.Fee,
			   a.CurrencyID,
			   a.SlID,
			   s.Title StuffTitle,
			   s.Title2 StuffTitle2,
			   c.Title CurrencyTitle,
			   c.Title2 CurrencyTitle2,
			   a.Type,
			   a.UniqueTaxID,
			   b.PartyID ContractPartyID,
			   prt.DlID PartyDlID,
			   a.DlId,
			   dl.Code DlCode,
			   dl.Title DLTitle,
			   dl.Title2 DLTitle2
		from CNT.ContractSubject a
		join cfg.Currency c on c.CurrencyID = a.CurrencyID
		join CNT.Contract b
			on a.ContractID = b.ContractID			
		join cfg.Party prt on b.PartyID = prt.PartyID
		join cnt.ContractSubject p
			on p.ContractSubjectID = a.ParentID
		left join stf.VWStuff s
			on s.StuffID = a.StuffID
		left join stf.StuffDetail sd
			on sd.StuffID = a.StuffID
		left join stf.StockDocumentTypeSlDl wip 
			on wip.StuffAccountGroupID = s.StuffAccountGroupID 
			and wip.StockDocumentTypeID = 3
		left join acc.sl
			on sl.SlID = case when a.SlID is not null then a.SlID
								 when sd.SlID is not null then sd.SlID
								 else wip.SlID end
		left join acc.dl
			on dl.DlID = a.SlID
								 
		where a.ParentID is not null
	)b 
	where Rno = 1
	) as src 
	LEFT join cte 
		on cte.ContractSubjectID = src.ContractSubjectID

