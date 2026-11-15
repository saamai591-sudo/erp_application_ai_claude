

CREATE   FUNCTION [CNT].[IsLastConfirmStatement]
(
    @ConfirmStatementID INT
)
RETURNS BIT
AS
BEGIN

    DECLARE @IsLast BIT = 0,
            @ContractID INT,
            @ContractSubjectID INT,
            @ContractStatementTypeID INT,
            @NumberOfCurrent INT,
            @NumberOfMax INT

    SELECT @ContractID = cs.ContractID,
           @ContractStatementTypeID = ContractStatementTypeID,
           @NumberOfCurrent = cs2.Number
    FROM CNT.ConfirmStatement cs
        LEFT JOIN CNT.ContractStatement cs2
            ON cs.ContractStatementID = cs2.ContractStatementID
    WHERE ConfirmStatementID = @ConfirmStatementID;

    SELECT @NumberOfMax = MAX(cs.Number)
    FROM CNT.ContractStatement cs
        JOIN CNT.ConfirmStatement cs2
            ON cs.ContractStatementID = cs2.ContractStatementID
    WHERE cs.ContractID = @ContractID
          AND ContractStatementTypeID = @ContractStatementTypeID;

    IF  @NumberOfCurrent = @NumberOfMax
        SET @IsLast = 1;


    RETURN @IsLast;
END;
