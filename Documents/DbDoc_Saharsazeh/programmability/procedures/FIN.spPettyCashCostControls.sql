------------------------------------- 
CREATE   PROCEDURE FIN.spPettyCashCostControls
(
    @Type TINYINT,
    @EntityID INT = NULL,
    @EntityIDs NVARCHAR(MAX) = NULL
)
--WITH ENCRYPTION
AS
BEGIN

    DECLARE @PettyCashTitle NVARCHAR(250),
            @LastAmount DECIMAL(30, 4),
            @MaxAmount DECIMAL(30, 4) = NULL,
            @Message NVARCHAR(MAX),
            @Culture NVARCHAR(5),
            @CultureNo TINYINT,
            @Titles NVARCHAR(MAX),
            @NegativeInventoryChecking bit;

    SET @Culture = CFG.GetuserCulture();

    SELECT @CultureNo = CultureNo
    FROM CFG.CultureInfo
    WHERE Culture = @Culture;

    IF (@Type = 1)
    BEGIN

        SELECT @PettyCashTitle = CASE @CultureNo
                                     WHEN 2 THEN
                                         f.Title2 + ' ' + d.Title2
                                     ELSE
                                         f.Title + ' ' + d.Title
                                 END,
               @LastAmount = la.LastAmount,
               @MaxAmount = p.MaxAmount
        FROM FIN.PettyCashCost c
            JOIN FIN.PettyCash p
                ON c.PettyCashID = p.PettyCashID
            JOIN CFG.Party AS p2
                ON p2.PartyID = p.PartyID
            JOIN ACC.DL AS d
                ON d.DLID = p2.DlID
            JOIN FIN.Fund f
                ON p.FundID = f.FundId
            JOIN FIN.PettyCash_LastAmount la
                ON p.PettyCashID = la.PettyCashID
        WHERE c.PettyCashCostID = @EntityID;

        IF (@MaxAmount IS NOT NULL AND @LastAmount > @MaxAmount)
        BEGIN
            SET @Message = N'PettyCashOverflowInventory^' + @PettyCashTitle;
            RAISERROR(@Message, 16, 12);
            RETURN 0;
        END;

    END;

    IF (@Type = 2)
    BEGIN

        SELECT @PettyCashTitle = CASE @CultureNo
                                     WHEN 2 THEN
                                         f.Title2 + ' ' + d.Title2
                                     ELSE
                                         f.Title + ' ' + d.Title
                                 END,
               @LastAmount = la.LastAmount
        FROM FIN.PettyCashCost c
            JOIN FIN.PettyCash p
                ON c.PettyCashID = p.PettyCashID
            JOIN CFG.Party AS p2
                ON p2.PartyID = p.PartyID
            JOIN ACC.DL AS d
                ON d.DLID = p2.DlID
            JOIN FIN.Fund f
                ON p.FundID = f.FundId
            JOIN FIN.PettyCash_LastAmount la
                ON p.PettyCashID = la.PettyCashID
        WHERE c.PettyCashCostID = @EntityID;

        select @NegativeInventoryChecking=pc.NegativeInventoryChecking
        from FIN.PettyCash as pc
        join FIN.PettyCashCost as pcc on pcc.PettyCashID=pc.PettyCashID
        where pcc.PettyCashCostID=@EntityID

        IF (@NegativeInventoryChecking=1 and @LastAmount < 0)
        BEGIN
            SET @Message = N'PettyCashNegativeInventory^' + @PettyCashTitle;
            RAISERROR(@Message, 16, 12);
            RETURN 0;
        END;

		IF EXISTS(
	    SELECT 1
		FROM FIN.PettyCashCostItem ci
		JOIN FIN.PettyCashCost c on ci.PettyCashCostID = c.PettyCashCostID
		LEFT JOIN PAY.vwPayPreparingRemain vw on ci.PayPreparingID = vw.PayPreparingID
		WHERE c.PettyCashCostID = @EntityID
		AND vw.Remain < 0)
		BEGIN
			SET @Message = N'FinanceManager.Messages.ThePaymentPasAlreadyBeenMadeBasedOnThePaymentSetupSelectedEarlier';
            RAISERROR(@Message, 16, 12);
            RETURN 0;
		END
    END;

    IF (@Type = 3)
    BEGIN

        SELECT *
        INTO #Ids
        FROM [CFG].[Split](@EntityIDs, ',');

        DECLARE @table TABLE
        (
            Title NVARCHAR(250) NOT NULL
        );

        INSERT @table
        SELECT CASE @CultureNo
                   WHEN 2 THEN
                       f.Title2 + ' ' + d.Title2
                   ELSE
                       f.Title + ' ' + d.Title
               END
        FROM FIN.PettyCashCost p
            JOIN FIN.PettyCash c
                ON p.PettyCashID = c.PettyCashID
            JOIN CFG.Party AS p2
                ON p2.PartyID = c.PartyID
            JOIN ACC.DL AS d
                ON d.DLID = p2.DlID
            JOIN FIN.Fund f
                ON c.FundID = f.FundId
            JOIN FIN.PettyCash_LastAmount la
                ON c.PettyCashID = la.PettyCashID
        WHERE EXISTS
        (
            SELECT value FROM #Ids WHERE value = p.PettyCashCostID
        )
              AND c.MaxAmount IS NOT NULL
              AND la.LastAmount > c.MaxAmount;

        IF EXISTS (SELECT 1 FROM @table)
        BEGIN
            SET @Titles = STUFF(
                          (
                              SELECT DISTINCT
                                     ' , ' + CAST(t.Title AS NVARCHAR(100))
                              FROM @table t
                              FOR XML PATH('')
                          ),
                          1,
                          3,
                          ''
                               );

            SET @Message = N'PettyCashOverflowInventory^' + @Titles;
            RAISERROR(@Message, 16, 12);
            RETURN 0;
        END;

    END;

END;

