
CREATE   PROCEDURE [POS].GetStoreSaleConsumeOutgoing
    (
        @stationId INT
    )
AS
    BEGIN

        DECLARE @DynamicColumns NVARCHAR(MAX) ,
                @selectColumn NVARCHAR(MAX),
				@Culture NVARCHAR(5),
			    @CultureNo tinyint
	    
		SET @Culture = cfg.GetuserCulture()	

		select @CultureNo = CultureNo
		from CFG.CultureInfo 
		where Culture = @Culture;


        SELECT DISTINCT st.TraceID
        INTO   #traces
        FROM   STF.StuffTrace AS st
               JOIN STF.StuffTraceDocumentNum AS stdn ON stdn.StuffTraceID = st.StuffTraceID
               JOIN STF.TraceDocumentNumType AS tdnt ON tdnt.TraceDocumentNumTypeID = stdn.TraceDocumentNumTypeID
               JOIN CFG.DocumentNumType AS dnt ON dnt.DocumentNumTypeID = tdnt.DocumentNumTypeID
        WHERE  dnt.EngName = 'Outgoing';


        SELECT @DynamicColumns = STUFF(
        (   SELECT   ',' + QUOTENAME(CAST(t.TraceID AS VARCHAR(5)))
            FROM     STF.Trace t
                     JOIN #traces ON #traces.TraceID = t.TraceID
            ORDER BY t.TraceID
            FOR XML PATH(''), TYPE   ).value('.', 'NVARCHAR(MAX)') ,
        1   ,
        1   ,
        ''  );

        IF ( @DynamicColumns IS NULL )
            SET @DynamicColumns = '[-1] ';


        SELECT @selectColumn = STUFF(
        (   SELECT   ',' + QUOTENAME(CAST(t.TraceID AS VARCHAR(5))) + ' AS '
                     + QUOTENAME('TR' + CAST(t.TraceID AS VARCHAR(5)))
            FROM     STF.Trace t
                     JOIN #traces ON #traces.TraceID = t.TraceID
            ORDER BY t.TraceID
            FOR XML PATH(''), TYPE ).value('.', 'NVARCHAR(MAX)') ,
        1   ,
        1   ,
        ''  );

        IF ( @selectColumn IS NULL )
            SET @selectColumn = '[-1] ';

		select  StuffID,
				code StuffCode,
				case when @CultureNo = 1 then Title else Title2 end StuffTitle,
				case when @CultureNo = 1 then MainMeasureUnit else MainMeasureUnit2 end MainUnit
			into #Stuff
		from stf.VWStuff

        DECLARE @query NVARCHAR(MAX);

        SET @query = N'
			SELECT src.OutgoingItemID ,
				   src.Number ,
				   src.StuffID ,
				   src.StuffCode ,
				   src.StuffTitle ,
				   src.MainUnit,
				   src.Non As MainQuantity,
				   ' + @selectColumn
                     + '
			FROM   (   SELECT oi.OutgoingItemID ,
							  o.Number ,
							  oi.StuffID ,
							  stf.StuffCode ,
							  stf.StuffTitle ,
							  stf.MainUnit,
							  oi.MainQuantity - ISNULL(used.MainQuantity, 0) AS Non,
							  ' + @DynamicColumns + '
					   FROM   STC.OutgoingItem AS oi
							  JOIN #Stuff AS stf ON stf.StuffID = oi.StuffID
							  JOIN STC.Outgoing AS o ON o.OutgoingID = oi.OutgoingID
							  JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
									ON o.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
							  JOIN STC.StockDocumentType AS sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
							  LEFT JOIN POS.Station AS s ON s.DlID = o.DeliverDlID
							  LEFT JOIN (   SELECT tr.OutgoingItemID ,
												   tr.TraceID ,
												   CASE WHEN tr.DlID IS NOT NULL THEN
															CAST(tr.DlID AS NVARCHAR(MAX))
														ELSE tr.Value
												   END Value
											FROM   STC.OutgoingItemTrace AS tr ) x
							  PIVOT (   MAX(Value)
										FOR TraceID IN ( ' + @DynamicColumns
                     + '
										)) AS piv ON piv.OutgoingItemID = oi.OutgoingItemID
					   WHERE  sdt.DocumentType = 13
							  AND s.StationID = @stationId ) src
			WHERE  Non > 0';

        EXEC sp_executesql @query ,
                           N'@stationId int' ,
                           @stationId = @stationId;
    END;

