import React, { useEffect, useState, useRef } from "react";
import Slider from "rc-slider";
import { RiHomeFill } from "react-icons/ri";
import cn from "classnames";

import styles from "./TrimSlider.module.css";
import "rc-slider/assets/index.css";

const TrimSlider = ({
  min = 0,
  max = 0,
  duration,
  onChange,
  onChangeComplete,
  startLabel = "",
  endLabel = "",
  className,
  disabled = false,
}) => {
  const [value, setValue] = useState([min, max]);
  const activeHandleindex = useRef();

  useEffect(() => {
    setValue([0, duration]);
  }, [duration]);

  const getNewValues = (newValues) => {
    const range = [...value];
    range[activeHandleindex.current] = newValues[activeHandleindex.current];
    return range;
  };

  return (
    <Slider
      disabled={disabled}
      className={cn(styles["trim-slider"], className, {
        "ud-invisible": disabled,
      })}
      allowCross={false}
      range={true}
      step={0.00001}
      min={min}
      max={max}
      value={value}
      onChange={(newValues) => {
        const newRange = getNewValues(newValues);
        setValue(newRange);
        onChange(newRange);
      }}
      onChangeComplete={(newValues) => {
        const newRange = getNewValues(newValues);
        onChangeComplete(newRange, activeHandleindex.current);
      }}
      styles={{
        track: { backgroundColor: "#276ef1" },
        rail: { visibility: "hidden" },
        dragging: { boxShadow: "none" },
        disabled: { backgroundColor: "#276ef1" },
      }}
      handleRender={(node, { index, dragging }) => {
        if (dragging) {
          activeHandleindex.current = index;
        }
        return (
          <div
            {...node.props}
            style={{
              ...node.props.style,
              boxShadow: "none",
              height: "60px",
              width: "48px",
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              border: "none",
              marginTop: "none",
              top: "-18px",
              backgroundColor: "transparent",
              opacity: 1,
            }}
          >
            <RiHomeFill
              className={cn(styles["slider-icon"], {
                [styles["disabled"]]: disabled,
              })}
              style={{
                transform: `rotate(${index === 0 ? "180deg" : "180deg"})`,
              }}
            />
            {startLabel &&
              endLabel(
                <div
                  style={{
                    position: "absolute",
                    top: "-35px",
                    color: "#fff",
                    fontWeight: "bold",
                    fontSize: "14px",
                    padding: "4px",
                    borderRadius: "4px",
                    backgroundColor: "#548BF4",
                  }}
                >
                  {index === 0 ? startLabel : endLabel}
                </div>
              )}
          </div>
        );
      }}
    />
  );
};

export default TrimSlider;
