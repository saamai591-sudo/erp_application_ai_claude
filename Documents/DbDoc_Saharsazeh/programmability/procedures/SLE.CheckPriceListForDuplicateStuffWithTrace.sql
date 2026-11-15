------------------------------------------------------------------------------------------------------
CREATE   PROCEDURE [SLE].[CheckPriceListForDuplicateStuffWithTrace] ( 
	@priceListId INT 
)
AS
    BEGIN

        DECLARE @SaleModelId INT ,
            @currencyId INT ,
            @EffectiveDate DATE ,
            @Columns AS NVARCHAR(MAX) ,
            @Query AS NVARCHAR(MAX) ,
            @innerJoin AS NVARCHAR(MAX)

        SELECT  @EffectiveDate = EffectiveDate ,
                @SaleModelId = SaleModelID ,
                @currencyId = CurrencyID
        FROM    SLE.PriceList
       WHERE   PriceListID = @priceListId

        SELECT  @Columns = STUFF((SELECT DISTINCT
                                            ',' + QUOTENAME(CAST(TraceID AS VARCHAR(5)))
                                  FROM      STF.Trace
                FOR              XML PATH('') ,
                                     TYPE
								   ).value('.', 'NVARCHAR(MAX)'), 1, 1, '')



        IF ( @Columns IS NULL )
            SET @Columns = '[-1]'
            


        SELECT  @innerJoin = STUFF((SELECT DISTINCT
                                            ' AND A.' + QUOTENAME( CAST(TraceID AS VARCHAR(5)))
                                            + '= B.' + QUOTENAME(CAST(TraceID AS VARCHAR(5)))
                                    FROM    STF.Trace t
                FOR                XML PATH('') ,
                                       TYPE
							   ).value('.', 'NVARCHAR(MAX)'), 1, 1, '')

        IF ( @innerJoin IS NULL )
            SET @innerJoin = ''

        SET @Query = N'SELECT s.Code  FROM 
			(
					SELECT pli.StuffID ,' + @Columns + '
					FROM    SLE.PriceListItem pli
					LEFT JOIN 
					(
					SELECT tr.PriceListItemID ,
							tr.TraceID ,
								CASE WHEN tr.DlID IS NOT NULL
														THEN CAST(tr.DlID AS NVARCHAR(MAX)) 
														ELSE tr.Value
												END Value
					FROM SLE.PriceListItemTrace tr) x
					PIVOT 
					(
						max(Value)
						for TraceID in ( ' + @Columns + ')
					)piv on piv.PriceListItemID = pli.PriceListItemID
					WHERE   pli.PriceListID = @priceListId
			) as A

			INNER JOIN

			(
				SELECT pli.StuffID,' + @Columns
            + '
				FROM    SLE.PriceListItem pli
				LEFT JOIN 
				(
				SELECT tr.PriceListItemID ,
						tr.TraceID ,
						 CASE WHEN tr.DlID IS NOT NULL
														THEN CAST(tr.DlID AS NVARCHAR(MAX)) 
														ELSE tr.Value
												END Value
				FROM SLE.PriceListItemTrace tr) x
				PIVOT 
				(
					max(Value)
					for TraceID in ( ' + @Columns
            + ')
				)piv on piv.PriceListItemID = pli.PriceListItemID
				WHERE   pli.PriceListID IN ( SELECT PriceListID
											FROM   SLE.PriceList
											WHERE  PriceListID <> @priceListId
												AND EffectiveDate = @EffectiveDate
												AND CurrencyID = @currencyId
												AND SaleModelID = @SaleModelId )
			) as B
										
											
			ON A.StuffID = B.StuffID ' + @innerJoin +' INNER JOIN STF.VWStuff s on A.StuffID = s.StuffID  '
			
        EXECUTE sp_executesql @Query, N'
				@priceListId INT ,
				@SaleModelId INT ,
				@currencyId INT ,
				@EffectiveDate DATE 
	     ', @priceListId = @priceListId, @SaleModelId = @SaleModelId,
            @currencyId = @currencyId, @EffectiveDate = @EffectiveDate

    END;
