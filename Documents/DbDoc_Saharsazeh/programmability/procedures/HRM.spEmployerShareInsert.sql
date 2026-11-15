CREATE   PROC [HRM].[spEmployerShareInsert]
    @Date DATE,
    @Level TINYINT,
    @Type TINYINT,
    @FoodTypeID INT,
    @Amount DECIMAL(30, 10),
    @Creator INT,
    @CreationDate DATE,
    @LastEditor INT,
    @LastEditionDate DATE

--WITH ENCRYPTION
AS
BEGIN
    SET NOCOUNT ON;
    SET XACT_ABORT ON;

	IF EXISTS(SELECT 1 FROM hrm.FoodOrder AS fo WHERE fo.Date> @Date)
	BEGIN
	    RAISERROR(N'WelfareManagement.Messages.FoodOrderExists', 16, 12);
        RETURN;
	END

    INSERT INTO HRM.EmployerShare
    (
        Date,
        Level,
        Type,
        Amount,
        FoodTypeID,
        Version,
        Creator,
        CreationDate,
        LastEditor,
        LastEditionDate
    )
    VALUES
    (   @Date,           -- Date - date
        @Level,          -- Level - tinyint
        @Type,           -- Type - tinyint
        @Amount,         -- Amount - decimal(30, 10)
        @FoodTypeID,     -- FoodTypeID - int
        0,        -- Version - int
        @Creator,        -- Creator - int
        @CreationDate,   -- CreationDate - datetime
        @LastEditor,     -- LastEditor - int
        @LastEditionDate -- LastEditionDate - datetime
        );

    -- Begin Return Select <- do not remove
    SELECT  EmployerShareID,
            [Version]
    FROM HRM.EmployerShare
    WHERE [EmployerShareID] = SCOPE_IDENTITY();
    -- End Return Select <- do not remove
END;
