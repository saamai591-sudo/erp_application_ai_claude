
---------------Start of #8789
CREATE   PROC [STM].SpRptPosInvoice @ID NVARCHAR(MAX),@StationPrintGroupId int
--WITH ENCRYPTION 
AS
BEGIN
    CREATE TABLE #Ids
    (
        id INT NOT NULL,
        itemOrder INT NOT NULL
    );

    INSERT INTO #Ids
    (
        id,
        itemOrder
    )
    SELECT [value],
           Position
    FROM CFG.R_FnCommaStr2Table(@ID);

	select a.CustomerID
	into #Party
	from pos.posinvoice a
	join #Ids b on a.PosInvoiceID = b.id
	group by a.CustomerID

    DECLARE @UserID INT,
            @DateType VARCHAR(10),
            @DateFormat VARCHAR(10),
            @Columns AS NVARCHAR(MAX),
            @Query AS NVARCHAR(MAX),
            @CustomeFields AS NVARCHAR(MAX),
            @CustomeFieldSelect AS NVARCHAR(MAX),
            @Culture VARCHAR(10),
            @TraceTable NVARCHAR(MAX),
            @EntityCustomFieldTable NVARCHAR(MAX);

    SET @Culture = CFG.GetuserCulture();

    SET @UserID = CFG.GetuserID();
    SET @TraceTable = cfg.getTempTableName(1);
    SET @EntityCustomFieldTable = cfg.getTempTableName(1);

    SELECT @DateType = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Type'
          AND us.UserID = @UserID;

    IF @DateType IS NULL
        SET @DateType = CASE @Culture
                            WHEN 'fa' THEN
                                0
                            WHEN 'en' THEN
                                1
                            WHEN 'ar' THEN
                                2
                        END;

    SELECT @DateFormat = us.SettingValue
    FROM CFG.UserSetting us
    WHERE us.SettingKey = 'Date_Format'
          AND us.UserID = @UserID;

    IF @DateFormat IS NULL
        SET @DateFormat = 'YY/MM/DD';

    SELECT @Columns = STUFF(
    (
        SELECT DISTINCT
               ',' + QUOTENAME(TraceID)
        FROM STF.Trace
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
                           );

    SELECT @CustomeFields = STUFF(
    (
        SELECT DISTINCT
               ',' + QUOTENAME(FieldName)
        FROM CFG.EntityCustomeField
        WHERE EntityName = 'PosInvoice'
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
                                 );

    IF (@CustomeFields IS NULL)
        SET @CustomeFields = N'[NoCustomeField]';

    SELECT @CustomeFieldSelect = STUFF(
    (
        SELECT DISTINCT
               ',CustomEntities.' + QUOTENAME(FieldName) + ' As cf_' + FieldName
        FROM CFG.EntityCustomeField
        WHERE EntityName = 'PosInvoice'
        FOR XML PATH(''), TYPE
    ).value('.', 'NVARCHAR(MAX)'),
    1   ,
    1   ,
    ''
                                      );
                                      
                                      
    IF (@CustomeFieldSelect IS NULL)
        SET @CustomeFieldSelect = N'[NoCustomeField]';

    IF (@Columns IS NULL)
        SET @Columns = N'[-1]';

    PRINT SYSDATETIME();

    SELECT a.PosInvoiceID,
           s.Title AS SubscriptionTitle,
           rt.Title AS RestaurantTableTitle
    INTO #Subscription
    FROM
    (
        SELECT pii.PosInvoiceID,
               ofo.SubscriptionID,
               ofo.RestaurantTableID
        FROM POS.PosInvoiceItem AS pii
            JOIN POS.OrderFoodItem AS ofi
                ON ofi.OrderFoodItemID = pii.OrderFoodItemID
            JOIN POS.OrderFood AS ofo
                ON ofo.OrderFoodID = ofi.OrderFoodID
        GROUP BY pii.PosInvoiceID,
                 ofo.SubscriptionID,
                 ofo.RestaurantTableID
    ) a
        LEFT JOIN POS.Subscription AS s
            ON s.SubscriptionID = a.SubscriptionID
        LEFT JOIN POS.RestaurantTable AS rt
            ON rt.RestaurantTableID = a.RestaurantTableID;

	select a.*
	INTO #Phone 
	from cfg.vwphone a
	join #Party p on p.CustomerID = a.PartyID

    PRINT SYSDATETIME();
select a.PartyID,TitleAddress [Address],ZipCode,country,province,county,city
	INTO #Address
	from cfg.VwAddress a
	join #Party p on p.CustomerID = a.PartyID
	where a.IsMain=1
    PRINT SYSDATETIME();
    SELECT DISTINCT
           v.*
    INTO #Stuff
    FROM STF.VWStuff AS v
        JOIN POS.PosInvoiceItem p
            ON v.StuffID = p.StuffID
        JOIN #Ids s
            ON p.PosInvoiceID = s.id;

    PRINT SYSDATETIME();

    SET @Query
        = N'select * into '+@TraceTable+N'
			from
			(
				select PosInvoiceItemID,TraceID,
				Case When t.DLID IS NOT NULL 
				THEN cast ((select title from acc.DL where dl.DLID=t.DlID) as nvarchar(max)) 
				when t.traceitemid is not null then cast ((select item from stf.traceitem ti where ti.traceitemid=t.traceitemid) as nvarchar(max))
				else Value end Value
				  from POS.PosInvoiceItemTrace t
				  left join acc.DL d on d.DLID=t.DlID
			) x
			pivot 
			( 	 max(Value) 	
				for TraceID in ( ' + @Columns + N')
			)  piv ';

    EXECUTE sys.sp_executesql @Query;

    PRINT SYSDATETIME();

    SET @Query
        = N'select * into '+@EntityCustomFieldTable+N'
			from
			(
				SELECT ecf.EntityID,ecfd.Fieldname,
				case when ecfd.fieldtype = 2 then CFG.GetCLRSaturnDate(ecf.[Value], ''' + @DateFormat + N'''  , 0, ''' + @DateType
							+ N''') else  ecf.[Value] end as Value
					FROM cfg.EntityCustomeField ecfd
				 JOIN cfg.EntityCustomeFieldData ecf ON ecf.EntityCustomeFieldID = ecfd.EntityCustomeFieldID
				Join #Ids ids on ecf.EntityID = ids.id and 	 ecfd.EntityName = ''PosInvoice'' 
			)x
			pivot 
			(
				max(Value)
				for Fieldname IN (' + @CustomeFields + N')
			)p' ;
			
		EXECUTE sys.sp_executesql @Query;
    

    PRINT SYSDATETIME();

    SET @Query
        = N'select 
				case p.Type   when 0 then p.Title+ '' ''+isnull(p.LastName,'''') else p.Title       End PartyName,p.Type PartyType,q.Number,
				CFG.GetCLRSaturnDate(q.[Date], ''' + @DateFormat + N'''  , 0, ''' + @DateType
					  + N''') [Date],                 
				q.PosInvoiceID,p.EconomicCode,p.NationalID,p.IdentificationCode,
				stf.Code,stf.Title StuffTitle,mu.Title UnitTitle,qi.MainQuantity,qi.SubQuantity,qi.Fee,
				case when stf.ExemptOfSellVat = 0 then 
					round(qi.Fee *(1+ isnull(( vr.TaxRate + vr.DutyRate) / 100 ,0)),0)
				else qi.Fee end AS 	  PosFee,
				case when stf.ExemptOfSellVat = 0 then 
					round(qi.Fee *(1+ isnull(( vr.TaxRate + vr.DutyRate) / 100 ,0)),0) * qi.MainQuantity 
				else qi.Price end AS PosPrice,	qi.Price,
				case when (qi.Tax + qi.Duty) > 0 then 
					round(qi.Discount *(isnull(( vr.TaxRate + vr.DutyRate) / 100 ,0)),0)
				else 0 end AS  PosDiscount	 ,
				qi.Discount,qi.Tax,qi.Duty,qi.Netprice,q.TotalDiscount,q.TotalDuty,q.TotalNetPrice,q.TotalPrice,q.TotalTax,
				mu2.Title SubUnitTitle,piv.*,CustomEntities.*,a.*,
				Vr.TaxRate,Vr.DutyRate,p.CustomerCode,d.code DlCode,	
				Fax,FixPhone,Mobile,Phone,us.Name CreatorName,
				Case when qi.Price=0 then 0 Else qi.Discount / qi.Price End DiscountPercent  ,
				Case stf.type when 0 then ''STUFF'' else ''Service'' End StuffType ,stf.Title,ss.Title StationShiftTitle,station.Title StationTitle,Station.StationID,
				sub.SubscriptionTitle,sub.RestaurantTableTitle,pr.Discount As ReceiptDiscount,CONVERT(varchar(8),q.CreationDate,108) InvoiceTime
			from Pos.PosInvoice q
				Inner join #Ids	on #ids.Id=q.PosInvoiceID
				LEFT JOIN #Subscription AS sub	ON sub.PosInvoiceID = q.PosInvoiceID
				JOIN POS.StationShift ss ON ss.StationShiftID = q.StateShiftID
				JOIN POS.Station	ON Station.StationID = ss.StationID   
				join Pos.PosInvoiceItem qi on q.PosInvoiceID = qi.PosInvoiceID
				left join ACC.VatRate vr on vr.FinancialPeriodId =  q.FinancialPeriodId
				left join #Phone Phone	on Phone.PartyID = q.CustomerID
				left join '+@TraceTable+N' piv	on piv.PosInvoiceItemID = qi.PosInvoiceItemID
				join #Stuff stf on stf.StuffID = qi.StuffID
                
				join stf.MeasureUnit mu on stf.MainMeasureUnitID = mu.MeasureUnitID
				LEFT join stf.stuffDetail st on st.StuffID=qi.StuffID
				LEFT join Stf.MeasureUnit mu2 on mu2.MeasureUnitID=st.MeasureSubUnitID
				join cfg.Party p on p.PartyID = q.CustomerID
				left join acc.dl d on d.dlid = p.dlid
				Left join #Address a on a.PartyID = p.PartyID 
				JOIN CFG.[User] us on us.UserID=q.Creator
				LEFT JOIN POS.PosReceipt AS pr ON pr.PosInvoiceID = q.PosInvoiceID
				left join '+@EntityCustomFieldTable+N' CustomEntities on CustomEntities.EntityID = q.PosInvoiceID                
            where    (@StationPrintGroupId is null or  qi.StuffID  in ( SELECT spgs.stuffid
           FROM   pos.StationPrintSetting AS sps
                  JOIN pos.StationPrintGroup AS spg
                       ON  spg.StationPrintGroupID = sps.StationPrintGroupID
                  JOIN pos.StationPrintGroupStuff AS spgs
                       ON  spgs.StationPrintGroupID = spg.StationPrintGroupID
           WHERE  spg.StationPrintGroupID = 1)
       )
			order by #ids.ItemOrder
            ';
            print @Query
    EXECUTE sp_executesql @query,
      N'@StationPrintGroupId int',
      @StationPrintGroupId = @StationPrintGroupId
END;

----------End of #8789
