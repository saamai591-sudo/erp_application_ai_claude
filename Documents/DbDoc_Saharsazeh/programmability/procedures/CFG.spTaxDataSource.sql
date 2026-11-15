
-----------Start of #8122
CREATE   PROC [CFG].spTaxDataSource
(
    @fromDate DATE,
    @toDate DATE,
    @FinancialPeriodID INT,
    @CompanyID INT,
	@ItemTableName NVARCHAR(MAX),
	@HeaderTableName NVARCHAR(MAX),
	@Selected StringArrayInput READONLY
)
as	
	 declare @Query nvarchar(max)

	 select a.DocName,a.DocID,b.Settellment
	  into #SelectedItem
	 from
	 (
		SELECT CFG.GetStringPartBySpliter(Val, 1, '#') DocName,
			   CFG.GetStringPartBySpliter(Val, 2, '#') DocID
		FROM   @Selected
	 )a
	 left join cfg.TaxData b on a.DocName = b.DocumentName and a.DocID = b.DocumentID

	SELECT * into #vwStuff
	FROM stf.VWStuff AS v
  
	  set @Query = N'
	  CREATE TABLE '+@ItemTableName+'
		(
			DocumentID int,
			DocumentItemID int,
			DocumentName nvarchar(256),
			Number nvarchar(256),
			[Date] Date,
			PartyID int,
			SaleTypeID int,
			CurrencyID int,
			ins nvarchar(10),
			ParentInvoiceID int,
			CurrencyRate decimal(36,10),
			FinancialPeriodID int,
			BranchID int,
			StuffID int,
			MainQuantity decimal(36,10),
			Fee decimal(36,10),
			Price decimal(36,10),
			Discount decimal(36,10),
			Vat decimal(36,10),
			NetPrice decimal(36,10),
			RowWeight decimal(36,10),
			CustomWeight decimal(36,10),
			StuffUniqueTaxID nvarchar(256),
			inp Nvarchar(5),
			ParentInvoiceUniqueTaxID Nvarchar(50),
			Settellment Tinyint,
			CottageNumber	nvarchar(50),
			CottageDate		date,
			RowNumber int,
			ReturnVat decimal(36,10),
			ReturnNet	decimal(36,10)
		)
		'
		exec(@Query)

		--Invoice
		BEGIN
			set @Query = N'
				   INSERT INTO '+@ItemTableName+'					
					SELECT h.InvoiceID       ,
							i.InvoiceItemID,
							''Invoice''    ,
							h.Number,
							h.[Date] ,
							h.CustomerID,
							h.SaleTypeID,
							h.CurrencyID,
							CASE 
							  WHEN h.SaleInvoiceStatus = 5
								   AND ISNULL(h.ParentInvoiceID, 0) <> 0 THEN ''3''
							  ELSE ''1''
							END   ins  ,
							h.ParentInvoiceID,
							h.CurrencyRate,
							h.FinancialPeriodID,
							h.BranchID,
							i.StuffID,
							i.MainQuantity,
							CAST(CAST(CEILING( CAST( convert(FLOAT,i.price)/convert(FLOAT,i.MainQuantity ) as DECIMAL (36,10))*100000000) as DECIMAL (36,10))/100000000 as Decimal(36,10)),
							i.Price,
							i.Discount,
							i.Tax + i.Duty ,
							i.NetPrice,
							CASE 
								WHEN s.MainUnitKilogram IS NOT NULL THEN i.MainQuantity * s.MainUnitKilogram
								WHEN s.SubUnitKilogram IS NOT NULL THEN i.SubQuantity * s.SubUnitKilogram
								ELSE i.MainQuantity * ISNULL(s.WeighUnitKilogram, 0)
							END                   RowWeight,
							AdditionalData.CustomWeight,
							s.UniqueTaxID         StuffUniqueTaxID,
							CASE WHEN  st2.type = 0 AND BaseDocument <> 11 then ''7'' when st2.type = 1 and BaseDocument <> 11 then ''1''  when BaseDocument = 11 then ''4'' end inp,
							td.UniqueTaxID as ParentInvoiceUniqueTaxID,
							si.Settellment,
							AdditionalData.CottageNumber,
							AdditionalData.CottageDate,
							i.RowIndex,
							Null,
							Null
					FROM   SLE.InvoiceItem    AS i
					JOIN SLE.Invoice   AS h
						ON  h.InvoiceID = i.InvoiceID
					JOIN sle.SaleType  AS st2
						ON  h.SaleTypeID = st2.SaleTypeID
					JOIN #vwStuff s
						ON  s.StuffID = i.StuffID
					LEFT JOIN CFG.TaxData AS td
						ON  h.ParentInvoiceID = td.DocumentID
						AND td.DocumentName = ''Invoice''
					LEFT JOIN (select * from (
									select cast(ecfd.EntityID as bigint) InvoiceID, ecf.FieldName,ecfd.Value from cfg.EntityCustomeFieldData ecfd
									join cfg.EntityCustomeField ecf on ecfd.EntityCustomeFieldID = ecf.EntityCustomeFieldID
									where ecf.EntityName = ''Invoice'' and ecf.FieldName in (
									''CottageNumber'',''CottageDate'',''CustomWeight''

									) ) x
									pivot (Max(value) for x.fieldname in ([CottageNumber],[CottageDate],[CustomWeight])) piv) AdditionalData
									on i.InvoiceID = AdditionalData.InvoiceID
					INNER JOIN  #SelectedItem si
						on si.DocName = ''Invoice'' and si.DocID = i.InvoiceID
						LEFT JOIN cnt.contractsubject  cs on i.ContractSubjectID = cs.ContractSubjectID
						LEFT JOIN cnt.contract c on cs.contractid = c.contractid
					'
				
			EXECUTE sp_executeSQL     
					@Query
		END


				--InvoiceCorrection
		BEGIN
			set @Query = N'
				   INSERT INTO '+@ItemTableName+'					
					SELECT 
					h.InvoiceCorrectionID       ,
							i.InvoiceCorrectionItemID,
							''InvoiceCorrection''    ,
							h.Number,
							h.[Date] ,
							h.CustomerID,
							invoice.SaleTypeID,
							invoice.CurrencyID,
							''2''   ins  ,
							h.ParentInvoiceID,
							invoice.CurrencyRate,
							fp.FinancialPeriodID,
							invoice.BranchID,
							item.StuffID,
							item.MainQuantity,
							CAST(CAST(CEILING( CAST( convert(FLOAT,i.RevisionPrice)/convert(FLOAT,item.MainQuantity ) as DECIMAL (36,10))*100000000) as DECIMAL (36,10))/100000000 as Decimal(36,10)),
							i.RevisionPrice,
							i.RevisionDiscount,
							i.RevisionVat ,
							i.RevisionNetPrice,
							CASE 
								WHEN s.MainUnitKilogram IS NOT NULL THEN item.MainQuantity * s.MainUnitKilogram
								WHEN s.SubUnitKilogram IS NOT NULL THEN item.SubQuantity * s.SubUnitKilogram
								ELSE item.MainQuantity * ISNULL(s.WeighUnitKilogram, 0)
							END                   RowWeight,
							AdditionalData.CustomWeight,
							s.UniqueTaxID         StuffUniqueTaxID,
							CASE WHEN  st2.type = 0 AND BaseDocument <> 11 then ''7'' when st2.type = 1 and BaseDocument <> 11 then ''1''  when BaseDocument = 11 then ''4'' end inp,
							td.UniqueTaxID as ParentInvoiceUniqueTaxID,
							si.Settellment,
							AdditionalData.CottageNumber,
							AdditionalData.CottageDate,
							item.RowIndex,
							Null,Null
					FROM   SLE.InvoiceCorrectionItem    AS i
					join Sle.InvoiceItem item on i.InvoiceItemID = item.InvoiceItemID
					JOIN SLE.InvoiceCorrection   AS h
						ON  h.InvoiceCorrectionID = i.InvoiceCorrectionID
					JOIN sle.Invoice invoice on h.ParentInvoiceID = invoice.InvoiceID					
					join cfg.FinancialPeriod fp on invoice.FinancialPeriodID = fp.FinancialPeriodID
					JOIN sle.SaleType  AS st2
						ON  invoice.SaleTypeID = st2.SaleTypeID
					JOIN #vwStuff s
						ON  s.StuffID = item.StuffID
					LEFT JOIN CFG.TaxData AS td
						ON  h.ParentInvoiceID = td.DocumentID
						AND td.DocumentName = ''Invoice''
					LEFT JOIN (select * from (
									select cast(ecfd.EntityID as bigint) InvoiceID, ecf.FieldName,ecfd.Value from cfg.EntityCustomeFieldData ecfd
									join cfg.EntityCustomeField ecf on ecfd.EntityCustomeFieldID = ecf.EntityCustomeFieldID
									where ecf.EntityName = ''Invoice'' and ecf.FieldName in (
									''CottageNumber'',''CottageDate'',''CustomWeight''

									) ) x
									pivot (Max(value) for x.fieldname in ([CottageNumber],[CottageDate],[CustomWeight])) piv) AdditionalData
									on invoice.InvoiceID = AdditionalData.InvoiceID
					INNER JOIN  #SelectedItem si
						on si.DocName = ''InvoiceCorrection'' and si.DocID = i.InvoiceCorrectionID
						LEFT JOIN cnt.contractsubject  cs on item.ContractSubjectID = cs.ContractSubjectID
						LEFT JOIN cnt.contract c on cs.contractid = c.contractid
					'
			
			EXECUTE sp_executeSQL     
					@Query
		END

	
	  --Returned Sale Invoice
	  BEGIN			
			declare @InvoiceID int,
					@ReturnedSaleInvoiceID int,
					@Rno int,
					@MaxPreReturnedSaleInvoiceID int,
					@uinqTaxID varchar(256)

			SELECT InvoiceID
			into #ReturnedInvoice
			FROM  SLE.vwReturnSaleInvoice_Invoice AS rsii 
			JOIN  #SelectedItem si
				ON si.DocName = 'ReturnedSaleInvoice' and si.DocID = rsii.ReturnedSaleInvoiceID
			group by InvoiceID

			SELECT  row_number() over(partition by  v.InvoiceItemID order by  rsii.ReturnedSaleInvoiceID,rsii.ReturnedSaleInvoiceItemID) Rno,
					rsii.ReturnedSaleInvoiceID,
					rsii.ReturnedSaleInvoiceItemID,
					v.InvoiceID,
					v.InvoiceItemID,
					rsii.StuffID,
					rsii.MainQuantity,
					rsii.Fee,
					rsii.Price,
					rsii.Discount,
					rsii.tax + rsii.Duty Vat,
					rsii.NetPrice
				into #OrderedReturnedSaleInvoiceItems
			FROM  SLE.ReturnedSaleInvoiceItem AS rsii 
			join SLE.vwReturnSaleInvoice_Invoice v 
				ON rsii.ReturnedSaleInvoiceItemID = v.ReturnedSaleInvoiceItemID 
			join #ReturnedInvoice ri
				ON ri.InvoiceID = v.InvoiceID
			where rsii.ReturnedSaleInvoiceID <= (select max(DocID) from #SelectedItem where DocName = 'ReturnedSaleInvoice')
			
			select  a.Rno,
					a.ReturnedSaleInvoiceID,
					a.ReturnedSaleInvoiceItemID,
					a.InvoiceID,
					a.InvoiceItemID,
					a.StuffID,
					a.Fee,
					sum(a.MainQuantity) over(partition by a.InvoiceItemID order by a.Rno) MainQuantity,
					sum(a.Price) over(partition by a.InvoiceItemID order by a.Rno) Price,
					sum(a.Discount) over(partition by a.InvoiceItemID order by a.Rno) Discount,
					sum(a.Vat) over(partition by a.InvoiceItemID order by a.Rno) Vat,
					sum(a.NetPrice) over(partition by a.InvoiceItemID order by a.Rno) NetPrice
				into #ReturnedSaleInvoiceItem
			from #OrderedReturnedSaleInvoiceItems a

			declare  @InvoicePool table
			(
				InvoiceID int
			)

			Create table #ModifiedInvoiceItemPool 
			(
				InvoiceID int,
				InvoiceItemID int,
				ParentInvoiceUniqueTaxID varchar(100),
				StuffID int,
				Fee decimal(36,10),
				MainQuantity decimal(36,10),
				Price decimal(36,10),
				Discount decimal(36,10),
				Vat decimal(36,10),
				NetPrice decimal(36,10),
				ReturnedSaleInvoiceID int,
				ReturnedSaleInvoiceItemID int,
				Settellment TINYINT
			)
			DECLARE @Settellment Tinyint
			DECLARE Invoice_Cursor CURSOR FOR
			SELECT InvoiceID,si.DocID,si.Settellment
			FROM #ReturnedSaleInvoiceItem a
			JOIN  #SelectedItem si
				ON si.DocName = 'ReturnedSaleInvoice' and si.DocID = a.ReturnedSaleInvoiceID
			ORDER BY Rno;

			OPEN Invoice_Cursor

			FETCH NEXT FROM Invoice_Cursor INTO @InvoiceID,@ReturnedSaleInvoiceID,@Settellment

			WHILE @@FETCH_STATUS = 0
			BEGIN
				
				if not exists (select 1 from @InvoicePool where InvoiceID = @InvoiceID)
				begin

					insert into @InvoicePool select @InvoiceID


					insert into  #ModifiedInvoiceItemPool
					select  ii.InvoiceID,
							ii.InvoiceItemID,
							null ParentInvoiceUniqueTaxID,
							ii.StuffID,
							ii.Fee,
							ii.MainQuantity - isnull(rsi.MainQuantity,0) ,
							ii.Price - isnull(rsi.Price,0),
							ii.Discount - isnull(rsi.Discount,0),
							(ii.tax + ii.Duty) - isnull(rsi.Vat,0) ,
							ii.NetPrice - isnull(rsi.NetPrice,0),
							@ReturnedSaleInvoiceID,
							null,
							@Settellment
					from sle.InvoiceItem ii
					left join 
					(select * ,
					ROW_NUMBER() over(partition by InvoiceItemID order by ReturnedSaleInvoiceItemID desc) Rno2
					from #ReturnedSaleInvoiceItem
					where ReturnedSaleInvoiceID <= @ReturnedSaleInvoiceID
					)rsi on rsi.Rno2 = 1 and ii.InvoiceItemID = rsi.InvoiceItemID
					where ii.InvoiceID = @InvoiceID 




					select @MaxPreReturnedSaleInvoiceID = MAX(ReturnedSaleInvoiceID) 
					from #ReturnedSaleInvoiceItem 
					where InvoiceID = @InvoiceID 
					and ReturnedSaleInvoiceID < @ReturnedSaleInvoiceID
					
										
					if @MaxPreReturnedSaleInvoiceID is null
						SELECT @uinqTaxID = ISNULL(td.UniqueTaxID,aa.UniqueTaxID)
						FROM   CFG.TaxData aa
						join sle.Invoice AS i on aa.DocumentID = i.InvoiceID and aa.DocumentName = 'invoice' and aa.DocumentID = @InvoiceID
						left join sle.InvoiceCorrection AS ic on ic.ParentInvoiceID = i.InvoiceID
						left join cfg.TaxData AS td on ic.InvoiceCorrectionID = td.DocumentID and td.DocumentName = 'InvoiceCorrection'
						
					if @MaxPreReturnedSaleInvoiceID is not null
						SELECT @uinqTaxID = aa.UniqueTaxID
						FROM   CFG.TaxData aa
						WHERE  aa.DocumentName = 'ReturnedSaleInvoice' and aa.DocumentID = @MaxPreReturnedSaleInvoiceID

					update  #ModifiedInvoiceItemPool 
					set ParentInvoiceUniqueTaxID = @uinqTaxID
					where InvoiceID = @InvoiceID
				end

				FETCH NEXT FROM Invoice_Cursor INTO @InvoiceID,@ReturnedSaleInvoiceID,@Settellment
			END
			CLOSE Invoice_Cursor;
			DEALLOCATE Invoice_Cursor;

						set @Query = N'
				   INSERT INTO '+@ItemTableName+'
				   SELECT i.ReturnedSaleInvoiceID ,
						  i.ReturnedSaleInvoiceItemID,
						  ''ReturnedSaleInvoice'' ,
						  h.Number,
						  h.[Date] ,
						  inv.CustomerID ,
						  inv.SaleTypeID,
						  inv.CurrencyID,
						  CASE 
								WHEN exists(select 1 from #ModifiedInvoiceItemPool where ReturnedSaleInvoiceID = i.ReturnedSaleInvoiceID and  MainQuantity > 0 ) then ''4''
								ELSE ''3''
							END   ins  ,
						  i.InvoiceID ParentInvoiceID,
						  inv.CurrencyRate,
						  inv.FinancialPeriodID,
						  inv.BranchID,
						  i.StuffID,
						  i.MainQuantity,
						  case when i.MainQuantity >0 then 
						  CAST(CAST(CEILING( CAST( convert(FLOAT,i.price)/convert(FLOAT,i.MainQuantity ) as DECIMAL (27,9))*100000000) as DECIMAL (26,8))/100000000 as Decimal(26,8)) else Fee end,
						  i.Price,
						  i.Discount,
						  floor( (i.Price - i.Discount) * CASE 
	                    WHEN ISNULL(s.ExemptOfSellVat, 0) = 1 THEN 0
	                    WHEN ISNULL(s.IsSpecialStuff, 0) = 1 THEN ISNULL(s.TaxRate, 0) + ISNULL(s.DutyRate, 0)
	                        ELSE ISNULL(vr.TaxRate, 0) + ISNULL(vr.DutyRate, 0)
	                   END/100 ),
						  
	                   i.Price - i.Discount + floor( (i.Price - i.Discount) * CASE 
	                    WHEN ISNULL(s.ExemptOfSellVat, 0) = 1 THEN 0
	                    WHEN ISNULL(s.IsSpecialStuff, 0) = 1 THEN ISNULL(s.TaxRate, 0) + ISNULL(s.DutyRate, 0)
	                        ELSE ISNULL(vr.TaxRate, 0) + ISNULL(vr.DutyRate, 0)
	                   END/100 ),
						  0            ,
						  0            ,
						  s.UniqueTaxID,
						  ''1'',
						  i.ParentInvoiceUniqueTaxID,
						  Settellment,
						  Null,
						  Null,0,
						 i.Vat , 
	                   i.NetPrice
				   FROM   #ModifiedInvoiceItemPool AS i
				    JOIN sle.ReturnedSaleInvoice h on h.ReturnedSaleInvoiceID = i.ReturnedSaleInvoiceID
					join sle.invoice inv on inv.invoiceID = i.invoiceID
					join acc.VatRate vr on h.FinancialPeriodID = vr.FinancialPeriodID
					JOIN #VWStuff  AS s
						ON  s.StuffID = i.StuffID
				   '
			EXECUTE sp_executeSQL     
					@Query

	  END
	  print 434354

	  --ConfirmStatement
	  BEGIN
		 set @Query = N'
			   INSERT INTO '+@ItemTableName+'
	           SELECT  cs.ConfirmStatementID        ,
	                   csi.ContractStatementID,
	                   ''ConfirmStatement''  ,
	                   cs.Number,
	                   cs.[Date] ,
	                   cs2.PartyID     ,
	                   Null as SaleTypeID,
	                   cs2.CurrencyID,
	                   ''1'' AS ins,
	                   NULL,
	                   cs.CurrencyRate,
	                   cs.FinancialPeriodID,
	                   c.BranchID,
	                   NULL,	
	                   1,	
	                   vcsi.amount,	
	                   vcsi.amount,
	                   0,	
	                   ISNULL(csi.Tax, 0) + ISNULL(csi.Duty, 0) AS itemVat,	
	                   round(vcsi.Amount * cs.CurrencyRate,0) + isnull(csi.Tax,0) + ISNULL(csi.Duty, 0),	
	                   0           AS RowWeight,
	                   0           AS CustomWeight,
	                   cs3.UniqueTaxID,
	                   ''4'',
	                   Null ParentInvoiceUniqueTaxID,
					   si.Settellment,
						  Null,
						  Null,0,Null,Null
	           FROM   cnt.ConfirmStatement AS cs
	            JOIN cnt.ContractStatement AS cs2
	                ON  cs2.ContractStatementID = cs.ContractStatementID
	            JOIN cnt.ContractStatementItem AS csi
	                ON  csi.ContractStatementID = cs2.ContractStatementID
	            JOIN cnt.ContractSubject AS cs3
	                ON  cs3.ContractSubjectID = csi.ContractSubjectID
	            JOIN cnt.[Contract] AS c
	                ON  c.ContractID = cs3.ContractID
	            JOIN cnt.VwContractStatementItem AS vcsi
	                ON  vcsi.ContractStatementItemID = csi.ContractStatementItemID
	            JOIN  #SelectedItem si
					on si.DocName = ''ConfirmStatement'' and si.DocID = cs.ConfirmStatementID 
				'
		 EXECUTE sp_executeSQL     
				@Query
	  END				

	  --PosInvoice
	  BEGIN
		set @Query = N'
				INSERT INTO '+@ItemTableName+'
				SELECT h.PosInvoiceID      AS ID,
						i.PosInvoiceItemID,
						''PosInvoice''        AS Entity,
						h.Number,
						h.[Date] AS [Date],
						h.CustomerID           PartyID,
						Null as SaleTypeID,
						-1 CurrencyID,
						''1''   ins  ,
						NULL,
						1.00000,
						h.FinancialPeriodID,
						s.BranchID,
						i.StuffID,
						i.MainQuantity,
						CAST(CAST(CEILING( CAST( convert(FLOAT,i.price)/convert(FLOAT,i.MainQuantity ) as DECIMAL (27,9))*100000000) as DECIMAL (26,8))/100000000 as Decimal(26,8)),
						i.Price,
						i.Discount,
						i.Tax + i.Duty      AS Vat,
						i.NetPrice,
						0                   AS RowWeight,
						0                   AS CustomWeight,
						v.UniqueTaxID,
						''1'',
						null,
						si.Settellment,
						  Null,
						  Null,0,Null,Null
				FROM   pos.PosInvoiceItem  AS i
				JOIN #VWStuff    AS v
					ON  v.StuffID = i.StuffID
				JOIN pos.PosInvoice AS h
					ON  h.PosInvoiceID = i.PosInvoiceID
				JOIN pos.StationShift AS ss
					ON  ss.StationShiftID = h.StateShiftID
				JOIN pos.Station    AS s
					ON  s.StationID = ss.StationID
				JOIN  #SelectedItem si
					on si.DocName = ''PosInvoice'' and si.DocID = i.PosInvoiceID
				'
		EXECUTE sp_executeSQL     
				@Query
	  END

	    --ReturnPosInvoice

	  select sum(pii.MainQuantity) Sold,pii.PosInvoiceID
	  into #SalePosInvoice
	  from pos.PosInvoiceItem pii
	  join (
	  select si.DocID,pi1.BasePosInvoiceID from #SelectedItem si
	  join pos.PosInvoice pi1 on si.DocID = pi1.PosInvoiceID and si.DocName = 'PosReturnInvoice') a on pii.PosInvoiceID = a.BasePosInvoiceID
	  group by pii.PosInvoiceID

	  create table #ReturnPosInvoiceRemain
	  (RowNumber				int,
	  SalePosInvoiceID			bigint,
	  ReturnPosInvoiceID		bigint,
	  Sold						decimal(36,10),
	  Returned					decimal(36,10),
	  SumReturn					decimal(36,10))

	  insert into #ReturnPosInvoiceRemain
	  select 1,PosInvoiceID,Null,Sold,0,0
	  from #SalePosInvoice	  

	  insert into #ReturnPosInvoiceRemain
	  select ROW_NUMBER() over(partition by spi.posinvoiceID order by pi1.date,pi1.PosInvoiceID) + 1,spi.PosInvoiceID SalePosInvoiceID,pi1.PosInvoiceID ReturnPosInvoiceID,spi.Sold,item.Returned,
	  sum(item.returned) over(partition by spi.posinvoiceID order by pi1.date,pi1.PosInvoiceID) SumReturn	 
	  from pos.PosInvoice pi1
	  join (select pi1.PosInvoiceID,sum(pi1.MainQuantity) Returned from pos.PosInvoiceItem pi1 
	  group by pi1.PosInvoiceID) item on pi1.PosInvoiceID = item.PosInvoiceID
	  join #SalePosInvoice spi on pi1.BasePosInvoiceID = spi.PosInvoiceID

	  select a.ReturnPosInvoiceID,a.SalePosInvoiceID,(case when b.ReturnPosInvoiceID is not null then b.ReturnPosInvoiceID else b.SalePosInvoiceID end) BasePosInvoiceID
	  ,td.UniqueTaxID,a.Sold - isnull(a.SumReturn,0) Remain 
	 into #ReturnPosInvoiceSource
	  from #ReturnPosInvoiceRemain a
	  join #ReturnPosInvoiceRemain b on a.RowNumber = b.RowNumber +1 and a.SalePosInvoiceID = b.SalePosInvoiceID
	  left join cfg.TaxData td on td.DocumentName = ( case when a.RowNumber = 2 then 'PosInvoice' else 'PosReturnInvoice' end) 
	  and td.DocumentID = (case when b.ReturnPosInvoiceID is not null then b.ReturnPosInvoiceID else b.SalePosInvoiceID end)

	  -----Get Items
	  select pii.StuffID,pr.ReturnPosInvoiceID,pii.PosInvoiceItemID,pii.Fee,pii.MainQuantity,pii.Price,pii.Tax,pii.Duty,pii.Discount,pii.NetPrice,
	  sum(rpii.MainQuantity) over(partition by pii.PosInvoiceItemID order by rpi.Date,rpi.posinvoiceID) SumReturnedQuantity,
	  sum(rpii.Price) over(partition by pii.PosInvoiceItemID order by rpi.Date,rpi.posinvoiceID) SumReturnedPrice,
	  sum(rpii.Tax+rpii.Duty) over(partition by pii.PosInvoiceItemID order by rpi.Date,rpi.posinvoiceID) SumReturnedVat,
	  sum(rpii.Discount) over(partition by pii.PosInvoiceItemID order by rpi.Date,rpi.posinvoiceID) SumReturnedDiscount,
	  sum(rpii.NetPrice) over(partition by pii.PosInvoiceItemID order by rpi.Date,rpi.posinvoiceID) SumReturnedNetPrice
	  	 into #ReturnInvoiceItem
	  from #SalePosInvoice h
	  join pos.PosInvoice p on h.PosInvoiceID = p.PosInvoiceID
	  join pos.PosInvoiceItem pii on h.PosInvoiceID = pii.PosInvoiceID
	  left join #ReturnPosInvoiceRemain pr on h.PosInvoiceID = pr.SalePosInvoiceID and pr.ReturnPosInvoiceID is not null
	  left join pos.PosInvoice rpi on pr.ReturnPosInvoiceID = rpi.PosInvoiceID
	  left join pos.PosInvoiceItem rpii on pr.ReturnPosInvoiceID = rpii.PosInvoiceID and pii.PosInvoiceItemID = rpii.ParentPosInvoiceItemID

	  BEGIN
		  set @Query = N'
				   INSERT INTO '+@ItemTableName+'
				   SELECT h.PosInvoiceID      AS ID,
						  i.PosInvoiceItemID,
						  ''PosReturnInvoice''  AS Entity,
						  h.Number,
						  h.[Date] AS [Date],
						  h.CustomerID           PartyID,
						  Null as SaleTypeID,
						  -1 as CurrencyID,
						  case when src.Remain>0 then ''4'' else ''3'' end ins,
						  src.BasePosInvoiceID,
						  1.00000,
						  h.FinancialPeriodID,
						  s.BranchID,
						  i.StuffID,
						  i.MainQuantity - isnull(i.SumReturnedQuantity,0) MainQuantity,
						  CAST(CAST(CEILING( CAST( convert(FLOAT,i.price)/convert(FLOAT,i.MainQuantity ) as DECIMAL (27,9))*100000000) as DECIMAL (26,8))/100000000 as Decimal(26,8)),
						  i.Price - isnull(i.SumReturnedPrice,0) Price ,
						  i.Discount - isnull(i.SumReturnedDiscount,0) Discount,
						  i.Tax + i.Duty - isnull(i.SumReturnedVat,0)      AS Vat,
						  i.NetPrice - isnull(i.SumReturnedNetPrice,0) NetPrice,
						  0                   AS RowWeight,
						  0                   AS CustomWeight,
						  v.UniqueTaxID,
						  ''1'',
						  src.UniqueTaxID as ParentInvoiceUniqueTaxID,
						  si.Settellment,
						  Null,
						  Null,0,Null,Null
				   FROM   #ReturnInvoiceItem  AS i
					JOIN #VWStuff    AS v
						ON  v.StuffID = i.StuffID
					JOIN pos.PosInvoice AS h
						ON  h.PosInvoiceID = i.ReturnPosInvoiceID
					JOIN #ReturnPosInvoiceSource AS src
						ON  src.ReturnPosInvoiceID = h.PosInvoiceID
					JOIN pos.StationShift AS ss
						ON  ss.StationShiftID = h.StateShiftID
					JOIN pos.Station    AS s
						ON  s.StationID = ss.StationID
					INNER JOIN  #SelectedItem si
						on si.DocName = ''PosReturnInvoice'' and si.DocID = h.PosInvoiceID
					'
		  EXECUTE sp_executeSQL     
					@Query
	  END
	  
	  set @Query = N'
	  CREATE TABLE '+@HeaderTableName+'
		(
			DocumentID int,
			DocumentName nvarchar(256),
			Number int,
			Date date,
			PartyID bigint,
			SaleTypeID int,
			CurrencyID int,
			TotalPrice decimal(36,10),
			TotalDiscount decimal(36,10),
			TotalNetPrice decimal(36,10),
			TotalVat decimal(36,10),
			TotalMainQuantity decimal(36,10),
			BaseTotalPrice decimal(36,10),
			BaseTotalDiscount decimal(36,10),
			BaseTotalVat decimal(36,10),
			BaseTotalNetPrice decimal(36,10),
			ins nvarchar(10),
			ParentInvoiceID int,
			ParentInvoiceUniqueTaxID nvarchar(50),
			CurrencyISOCode nvarchar(10),
			inty  nvarchar(10),
			[Settellment] TinyInt

		)
		'
		exec(@Query)
		
		SELECT vrsii.InvoiceID, vrsii.ReturnedSaleInvoiceID INTO #vwReturnSaleInvoice_Invoice
		FROM sle.vwReturnSaleInvoice_Invoice AS vrsii
		GROUP BY vrsii.InvoiceID, vrsii.ReturnedSaleInvoiceID
	
	  set @Query = N'
			INSERT INTO '+@HeaderTableName+'
			SELECT     
					   DocumentID,
					   DocumentName,	
					   t.Number,
					   t.Date,
					   t.PartyID,		
					   t.SaleTypeID,
					   t.CurrencyID,		   
					   SUM(Price)                        TotalPrice,
					   SUM(Discount)                     TotalDiscount,
					   SUM(NetPrice)                     TotalNetPrice,
					   SUM(Vat)                          TotalVat,
					   SUM(MainQuantity)                 TotalMainQuantity,
					   isnull(MAX(i.TotalPrice),Max(BasePoseInvoice.TotalPrice))                 BaseTotalPrice,
					   isnull(MAX(i.TotalDiscount),Max(BasePoseInvoice.TotalDiscount))              BaseTotalDiscount,
					   isnull(MAX(i.TotalTax + i.TotalDuty),Max(BasePoseInvoice.TotalTax+BasePoseInvoice.TotalDuty))     BaseTotalVat,
					   isnull(MAX(i.TotalNetPrice),MAX(BasePoseInvoice.TotalNetPrice))              BaseTotalNetPrice,
					   t.ins  ,
						t.ParentInvoiceID,
						t.ParentInvoiceUniqueTaxID,
						Max(cur.Code) CurrencyISoCode,
						CASE 
							WHEN ecfd.EntityID IS NOT NULL THEN ''2''
							ELSE ''1''
							END                        AS inty,
						isnull(t.Settellment,1)
				FROM   '+@ItemTableName+'                        AS t
					   Join cfg.Currency cur on t.CurrencyID = cur.CurrencyID	
					   LEFT JOIN #vwReturnSaleInvoice_Invoice AS vrsii
							ON  t.DocumentID = vrsii.ReturnedSaleInvoiceID
							AND t.DocumentName = ''ReturnedSaleInvoice''
					   LEFT JOIN sle.Invoice          AS i
							ON  vrsii.InvoiceID = i.InvoiceID
					   LEFT JOIN pos.PosInvoice BasePoseInvoice 
							ON t.ParentInvoiceID = 	BasePoseInvoice.PosInvoiceID 
							AND t.DocumentName = ''PosReturnInvoice''
					   LEFT JOIN (
								SELECT b.EntityID
								FROM   CFG.EntityCustomeField a
									   JOIN CFG.EntityCustomeFieldData b
											ON  a.EntityCustomeFieldID = b.EntityCustomeFieldID
									   JOIN CFG.LookupDataItem c
											ON  b.LookupDataItemID = c.LookupDataItemID
								WHERE  a.FieldName = ''HCType1Code''
									   AND c.Code = 8
								) ecfd
									ON  ecfd.EntityID = t.PartyID
				GROUP BY
					   DocumentName,
					   DocumentID,
					   PartyID,
					   t.SaleTypeID,
					   t.CurrencyID,
					   t.ParentInvoiceID,
					   t.Number,
					   t.Date,
					   t.ParentInvoiceUniqueTaxID,
					   ecfd.EntityID,
					   Settellment,
					   t.ins	
					   '
	EXEC (@Query)
	--EXEC (N'select * from '+@HeaderTableName)
	
	--EXEC (N'select * from '+@ItemTableName)
	
	---------------End of #8122
