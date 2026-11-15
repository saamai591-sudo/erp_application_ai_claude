------------------------------------------------------------------------------------------------------------------
CREATE   PROCEDURE [STC].[GetReturnedOutgoingItemsForSelector]
    (
      @Financial INT ,
      @date DATE ,
      @BranchId INT
    )
  --  WITH ENCRYPTION
AS
BEGIN
	declare @Culture NVARCHAR(100),
			@CultureNo tinyint
	    
	SET @Culture = cfg.GetuserCulture()	

	select @CultureNo = CultureNo
	from CFG.CultureInfo 
	where Culture = @Culture

    SELECT  i.ReturnedOutgoingItemID ,
            i.ReturnedOutgoingID ,
            i.StuffID ,
            CASE WHEN Revision.RevisionFee IS NOT NULL
                    THEN Revision.RevisionFee
                    ELSE i.Fee
            END LastRevisionedCost ,
            CASE WHEN Revision.RevisionPrice IS NOT NULL
                    THEN Revision.RevisionPrice
                    ELSE i.Price
            END Price ,
            i.MainQuantity ,
            i.SubQuantity ,
            i.Fee ,
            sdt.DocumentType AS ReturnedType ,
            h.Number ,
            stf.GetStuffCode(i.StuffID) StuffCode ,
			case @CultureNo
				when 1 then stf.Title
				when 2 then stf.Title2
			end as StuffTitle ,
            CFG.GetCLRSaturnDate(h.Date, 'YY/MM/DD', 0, 0) DateString
    INTO    #ReturnedOutgoingItem
    FROM    STC.ReturnedOutgoingItem i
            JOIN STC.ReturnedOutgoing h ON h.ReturnedOutgoingID = i.ReturnedOutgoingID
            JOIN [STC].[StockDocumentTypeBaseEntity] sdtb 
                ON h.StockDocumentTypeBaseEntityID = sdtb.StockDocumentTypeBaseEntityID
			JOIN STC.StockDocumentType sdt ON sdt.StockDocumentTypeID = sdtb.StockDocumentTypeID
            JOIN STF.VWStuff stf ON stf.StuffID = i.StuffID
            JOIN STF.Stock stc ON stc.StockID = h.StockID
            LEFT JOIN ( SELECT  ROW_NUMBER() OVER ( PARTITION BY ReturnedOutgoingItemID ORDER BY Number DESC ) Rno ,
                                i.ReturnedOutgoingItemID ,
                                RevisionPrice ,
                                i.RevisionFee
                        FROM    STC.RevisionCost h
                                JOIN STC.RevisionCostItem i ON h.RevisionCostID = i.RevisionCostID
                        WHERE   i.ReturnedOutgoingItemID IS NOT NULL
                        ) Revision ON Rno = 1
                                    AND Revision.ReturnedOutgoingItemID = i.ReturnedOutgoingItemID
    WHERE   h.FinancialPeriodID = @Financial
            AND i.OutgoingItemID IS NULL
            AND h.Date <= @date
            AND stc.BranchID = @BranchId;
				
    SELECT  ReturnedOutgoingItemID ,
            ReturnedOutgoingID ,
            StuffID ,
            LastRevisionedCost ,
            Price ,
            MainQuantity ,
            SubQuantity ,
            Fee ,
            ReturnedType ,
            Number ,
            StuffCode ,
            StuffTitle ,
            DateString
    FROM    #ReturnedOutgoingItem;

    SELECT  t.ReturnedOutgoingItemTraceID ,
            t.ReturnedOutgoingItemID ,
            t.TraceID ,
            t.DlID ,
			d.Code AS DlCode,
            t.Value ,
			t.TraceItemID
    FROM    STC.ReturnedOutgoingItemTrace t
            JOIN #ReturnedOutgoingItem i ON i.ReturnedOutgoingItemID = t.ReturnedOutgoingItemID
			LEFT JOIN ACC.DL AS d ON d.DLID = t.DlID
END;
