

CREATE   PROC [STF].[spTraceItemUpdate]
    @TraceItemID INT,
    @TraceListTypeID INT,
    @Item NVARCHAR(1024),
    @Item2 NVARCHAR(1024),
    @RowIndex SMALLINT,
    @LastEditor INT,
    @LastEditionDate DATETIME,
    @Version INT,
    @Code NVARCHAR(255)

--WITH ENCRYPTION 
AS
BEGIN
    SET NOCOUNT ON;

    IF @Version <>
    (
        SELECT [Version] FROM [STF].[TraceItem] WHERE [TraceItemID] = @TraceItemID
    )
        RAISERROR('Version mismatch...', 16, 10);

    DECLARE @msg NVARCHAR(MAX);

    IF EXISTS
    (
        SELECT 1
        FROM STF.TraceItem AS ti
        WHERE ti.Item = @Item
		      and TraceListTypeID = @TraceListTypeID
              AND ti.TraceItemID <> @TraceItemID
    )
    BEGIN
        SET @msg = N'StuffManager.TraceItemTitleIsDuplicate^' + CAST(@RowIndex AS NVARCHAR(100));
        RAISERROR(@msg, 16, 12);
        RETURN;
    END;


    IF EXISTS
    (
        SELECT 1
        FROM STF.TraceItem AS ti
        WHERE ti.Item2 = @Item2
		      and TraceListTypeID = @TraceListTypeID
              AND ti.TraceItemID <> @TraceItemID
    )
    BEGIN
        SET @msg = N'StuffManager.TraceItemTitleIsDuplicate^' + CAST(@RowIndex AS NVARCHAR(100));
        RAISERROR(@msg, 16, 12);
        RETURN;
    END;


    IF EXISTS
    (
        SELECT 1
        FROM STF.TraceItem AS ti
        WHERE ti.Code = @Code
		      and TraceListTypeID = @TraceListTypeID
              AND ti.TraceItemID <> @TraceItemID
    )
    BEGIN
        SET @msg = N'StuffManager.TraceItemCodeIsDuplicate^' + CAST(@RowIndex AS NVARCHAR(100));
        RAISERROR(@msg, 16, 12);
        RETURN;
    END;

    UPDATE [STF].[TraceItem]
    SET [Item] = @Item,
        [Item2] = @Item2,
        [LastEditor] = @LastEditor,
        [LastEditionDate] = @LastEditionDate,
        [Version] = @Version + 1,
        RowIndex = @RowIndex,
        TraceListTypeID = @TraceListTypeID,
        Code = @Code
    WHERE [TraceItemID] = @TraceItemID;

    -- Begin Return Select <- do not remove
    SELECT  [Version] 
    FROM [STF].[TraceItem]
    WHERE [TraceItemID] = @TraceItemID;
-- End Return Select <- do not remove


END;
